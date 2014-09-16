Games Portal Client
=====================

## Using this project

1. Clone the repo

2. Install dependencies
```bash
$ npm install
$ bower install
```
3. Edit ./src/config.js

4. Launch `gulp`, which builds files, watches them, runs a server at localhost:8080 (default)

5. Open browser at http://localhost:8080

6. Edit code ./src/

7git ad. $$$


## Build

Building is done into the `build/` directory, and is run by: `gulp build`.
Notice that the `build/` dir is .git ignored.

## Deploy

Please add ./ignored/aws.json file with following fields : 'key', 'secret', 'bucket'

```bash
$ gulp deploy
```


**Notice that the images & fonts from the build dir aren't copied, since they mostly stay the same. To deploy them as well - uncomment that section in the gulp task of `deploy`**

