set -e

export NODE_OPTIONS=""

node process.ts | tee process.json

cat <<EEE

  typechecking...

EEE

node_modules/.bin/tsc

cat <<EEE

  transpiling...

EEE

find . -path './node_modules' -prune -o -path './.git' -prune -o -type f -name '*.ts' -print | node gitignore.js .myignore | node es.ts