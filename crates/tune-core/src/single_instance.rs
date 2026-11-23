//! One app at a time: two would both send settings to the mouse. The first one holds a lock file and listens on a
//! socket next to it; a later start asks it to show its window and then ends.

use std::fs::{File, OpenOptions, TryLockError};
use std::io::{ErrorKind, Read, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::Path;
use std::time::Duration;

const SHOW: &[u8] = b"show\n";
/// How long a later start keeps trying to reach a first one that is still starting.
const REACH_TRIES: u32 = 30;
const REACH_PAUSE: Duration = Duration::from_millis(100);
const READ_TIMEOUT: Duration = Duration::from_secs(1);

#[derive(Debug)]
pub enum Instance {
    /// No other one runs. Keep this for as long as the app runs: dropping it lets another one start.
    First(Primary),
    /// Another one runs; `reached` tells whether it got the request to show its window.
    Other { reached: bool },
}

#[derive(Debug)]
pub struct Primary {
    lock: File,
    listener: UnixListener,
}

/// Claims `<dir>/<name>.lock`, or asks the app that holds it to show its window.
pub fn claim(dir: &Path, name: &str) -> std::io::Result<Instance> {
    std::fs::create_dir_all(dir)?;
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join(format!("{name}.lock")))?;
    let socket = dir.join(format!("{name}.sock"));
    match lock.try_lock() {
        Ok(()) => {
            // The lock is ours, so a socket file left here belongs to an app that is gone.
            match std::fs::remove_file(&socket) {
                Err(e) if e.kind() != ErrorKind::NotFound => return Err(e),
                _ => {}
            }
            let listener = UnixListener::bind(&socket)?;
            Ok(Instance::First(Primary { lock, listener }))
        }
        Err(TryLockError::WouldBlock) => Ok(Instance::Other {
            reached: ask_to_show(&socket),
        }),
        Err(TryLockError::Error(e)) => Err(e),
    }
}

fn ask_to_show(socket: &Path) -> bool {
    for _ in 0..REACH_TRIES {
        if let Ok(mut stream) = UnixStream::connect(socket) {
            return stream.write_all(SHOW).is_ok();
        }
        std::thread::sleep(REACH_PAUSE);
    }
    false
}

impl Primary {
    /// Answers later starts on a thread of its own for as long as the app runs, calling `show` for each.
    pub fn serve(self, show: impl Fn() + Send + 'static) -> std::io::Result<()> {
        std::thread::Builder::new()
            .name("single-instance".into())
            .spawn(move || {
                // Held by this thread, which lives as long as the app.
                let _lock = self.lock;
                for stream in self.listener.incoming() {
                    let Ok(stream) = stream else { continue };
                    // A caller that connects and sends nothing must not hold up the next one.
                    if stream.set_read_timeout(Some(READ_TIMEOUT)).is_err() {
                        continue;
                    }
                    let mut request = Vec::new();
                    if stream.take(SHOW.len() as u64).read_to_end(&mut request).is_ok() && request == SHOW {
                        show();
                    }
                }
            })
            .map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn a_second_start_asks_the_first_to_show_its_window() -> TestResult {
        let dir = tempfile::tempdir()?;
        let Instance::First(primary) = claim(dir.path(), "tune")? else {
            return Err("the first start should own the lock".into());
        };
        let (shown, requests) = mpsc::channel();
        primary.serve(move || {
            let _ = shown.send(());
        })?;

        assert!(matches!(claim(dir.path(), "tune")?, Instance::Other { reached: true }));
        requests.recv_timeout(Duration::from_secs(5))?;
        // The mock app runs apart from the real one.
        assert!(matches!(claim(dir.path(), "tune-mock")?, Instance::First(_)));
        Ok(())
    }

    #[test]
    fn a_socket_left_behind_does_not_block_a_new_start() -> TestResult {
        let dir = tempfile::tempdir()?;
        std::fs::write(dir.path().join("tune.sock"), "")?;
        assert!(matches!(claim(dir.path(), "tune")?, Instance::First(_)));
        Ok(())
    }

    #[test]
    fn the_lock_is_free_again_once_the_first_one_is_gone() -> TestResult {
        let dir = tempfile::tempdir()?;
        let first = claim(dir.path(), "tune")?;
        assert!(matches!(first, Instance::First(_)));
        drop(first);
        assert!(matches!(claim(dir.path(), "tune")?, Instance::First(_)));
        Ok(())
    }
}
