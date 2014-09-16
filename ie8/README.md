Games Portal Client
=====================

## Using this project

1. Clone the repo

2. Install dependencies
```bash
$ npm install
```
3. Launch `gulp`, which builds files, watches them, runs a server at localhost:8080 (default)

4. Open browser at http://localhost:8080

5. $$$


## Build

Building is done into the `build/` directory, and is run by: `gulp build`.
Notice that the `build/` dir is .git ignored.

## Deploy

You can deploy to either the amazon s3 bucket of Gamestab (play.gamestab.me) with:

```bash
$ gulp gamestab
```

Or deploy to the s3 bucket of Mojo-Games (www.mojo-games.com):

```bash
$ gulp mojo
```

**Notice that the images & fonts from the build dir aren't copied, since they mostly stay the same. To deploy them as well - uncomment that section in the gulp task of `deploy`**

## Analytics Ids:

### http://www.mojo-games.com
**UA-49896275-3**

### http://play.gamestab.me
**UA-47928276-8**


