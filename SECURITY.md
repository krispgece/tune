# Security

## Reporting a problem

Please report security problems privately, not in a public issue: use
[Report a vulnerability](https://github.com/krispgece/tune/security/advisories/new) on GitHub, which needs a GitHub
account. The report is not public: only you, the maintainer and anyone the maintainer asks to help fix it can see it.

Helpful to include:

- the Tune version (Settings › About) and how you installed it (package or a build from source),
- your distribution,
- the steps that show the problem, and what someone could do with it.

Problems in the device library (ssgg) can be reported here as well; they are passed on to its maintainers.

## What counts

For example: a way for someone other than the user signed in at the computer (another account, or a login over SSH)
to change the mouse's settings or Tune's files, a package or udev rule that gives more access than the mouse's
settings interface, or a way to make Tune run code it should not.

Not a security problem: the user signed in at the computer, and every program that user runs, can reach the mouse's
settings interface and Tune's files. That is how Tune works; when several people share the computer, this access goes
to whoever is using it at the moment.

## Supported versions

Only the latest release gets fixes. Tune is kept by one person, so a reply can take some days.
