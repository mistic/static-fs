# Contributing to static-fs

First of all thanks for showing interest in contributing to this project.
If in the end of this document you still have some doubt, please be free to 
open an issue. 

Please note we have a code of conduct, please follow it in all your interactions with the project.

## Setup project locally

### Node
You need the engines declared version for node installed on your machine 
in order to setup that project.
It is possible to check the required version in the [package.json](https://github.com/mistic/static-fs/blob/master/package.json) 

If you're using a node version manager tool such like [nvm](https://github.com/nvm-sh/nvm) you 
can just run: 

```bash
nvm install
```

### Yarn
We also rely on [yarn](https://yarnpkg.com) in order to manage our dependencies.
You can install it following the [official yarn install instructions](https://yarnpkg.com/en/docs/install).

Please note that you need to install the engines declared version for yarn 
defined in the [package.json](https://github.com/mistic/static-fs/blob/master/package.json)

After this step you can just install our dependencies running:

```bash
yarn install
```

## Commit Process

In this project we use some tools to ensure our commits follow a standard 
known as [conventional commits](https://www.conventionalcommits.org/en/v1.0.0-beta.4/)

In order to achieve this automatically we use `commitlint` and `commitizen`.

The first one will run as part as a git hook upon commit and the second one 
can be used as a cli tool to help writing the commits in the expected format.
Instead of use `git commit` just use `yarn cm` in you wanna use that helper tool.

## Pull Request Process

1. Ensure you just add only essential files to the PR.
2. Ensure the README.md or any other documentation to support your new changes
   are updated or were created along with the PR.
3. Write tests to cover your new changes. 
4. Once the PR is open you will need to wait for at least one review 
   from one of the project administrators before it is able to be merged. 

## Code of Conduct

### Our Pledge

In the interest of fostering an open and welcoming environment, we as
contributors and maintainers pledge to making participation in our project and
our community a harassment-free experience for everyone, regardless of age, body
size, disability, ethnicity, gender identity and expression, level of experience,
nationality, personal appearance, race, religion, or sexual identity and
orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment
include:

* Using welcoming and inclusive language
* Being respectful of differing viewpoints and experiences
* Gracefully accepting constructive criticism
* Focusing on what is best for the community
* Showing empathy towards other community members

Examples of unacceptable behavior by participants include:

* The use of sexualized language or imagery and unwelcome sexual attention or
advances
* Trolling, insulting/derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or electronic
  address, without explicit permission
* Other conduct which could reasonably be considered inappropriate in a
  professional setting

### Our Responsibilities

Project maintainers are responsible for clarifying the standards of acceptable
behavior and are expected to take appropriate and fair corrective action in
response to any instances of unacceptable behavior.

Project maintainers have the right and responsibility to remove, edit, or
reject comments, commits, code, wiki edits, issues, and other contributions
that are not aligned to this Code of Conduct, or to ban temporarily or
permanently any contributor for other behaviors that they deem inappropriate,
threatening, offensive, or harmful.

### Scope

This Code of Conduct applies both within project spaces and in public spaces
when an individual is representing the project or its community. Examples of
representing a project or community include using an official project e-mail
address, posting via an official social media account, or acting as an appointed
representative at an online or offline event. Representation of a project may be
further defined and clarified by project maintainers.

### Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage], version 1.4,
available at [http://contributor-covenant.org/version/1/4/][version] and created 
from a publicly available [Template][template].

[homepage]: http://contributor-covenant.org
[version]: http://contributor-covenant.org/version/1/4/
[template]: https://gist.github.com/PurpleBooth/b24679402957c63ec426
