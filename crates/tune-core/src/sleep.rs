//! Notices the computer waking from sleep. The mouse may come back from sleep without its settings even when it was
//! not plugged in again.

use std::time::Duration;

/// More sleep than this between two looks counts as a wake; less is the gap between reading the two clocks.
const MIN_SLEEP: Duration = Duration::from_secs(1);

/// How long the computer has been asleep since it started, or `None` where that cannot be read.
#[cfg(target_os = "linux")]
pub fn time_asleep() -> Option<Duration> {
    use rustix::time::{ClockId, Timespec, clock_gettime};

    fn duration(time: Timespec) -> Option<Duration> {
        Some(Duration::new(
            u64::try_from(time.tv_sec).ok()?,
            u32::try_from(time.tv_nsec).ok()?,
        ))
    }
    // The boot clock runs on while the computer sleeps and the monotonic clock does not.
    let since_boot = duration(clock_gettime(ClockId::Boottime))?;
    let awake = duration(clock_gettime(ClockId::Monotonic))?;
    Some(since_boot.saturating_sub(awake))
}

#[cfg(not(target_os = "linux"))]
pub fn time_asleep() -> Option<Duration> {
    None
}

/// Counts the wakes seen between one look and the next.
#[derive(Debug, Default)]
pub struct WakeCounter {
    asleep: Option<Duration>,
    wakes: u32,
}

impl WakeCounter {
    /// Takes how long the computer has been asleep so far and returns the number of wakes seen.
    pub fn observe(&mut self, asleep: Option<Duration>) -> u32 {
        if let (Some(before), Some(now)) = (self.asleep, asleep)
            && now.saturating_sub(before) >= MIN_SLEEP
        {
            self.wakes = self.wakes.wrapping_add(1);
        }
        if asleep.is_some() {
            self.asleep = asleep;
        }
        self.wakes
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const fn secs(n: u64) -> Option<Duration> {
        Some(Duration::from_secs(n))
    }

    #[test]
    fn a_longer_sleep_since_the_last_look_is_a_wake() {
        let mut counter = WakeCounter::default();
        assert_eq!(counter.observe(secs(40)), 0, "the first look only takes the start");
        assert_eq!(counter.observe(secs(40)), 0);
        assert_eq!(
            counter.observe(Some(Duration::from_millis(40_300))),
            0,
            "too short to be a sleep"
        );
        assert_eq!(counter.observe(secs(400)), 1);
        assert_eq!(counter.observe(secs(400)), 1);
        assert_eq!(counter.observe(secs(500)), 2);
    }

    #[test]
    fn without_a_reading_nothing_counts() {
        let mut counter = WakeCounter::default();
        assert_eq!(counter.observe(None), 0);
        assert_eq!(counter.observe(secs(10)), 0);
        assert_eq!(counter.observe(None), 0);
        assert_eq!(
            counter.observe(secs(100)),
            1,
            "the last reading is kept across a missing one"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn the_time_asleep_can_be_read_here() {
        assert!(time_asleep().is_some());
    }
}
