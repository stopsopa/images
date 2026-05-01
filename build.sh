set -e

export NODE_OPTIONS=""

cat <<EEE

  typechecking...

EEE

node_modules/.bin/tsc

cat <<EEE

  transpiling...

EEE

find images -path './node_modules' -prune -o -path './.git' -prune -o -type f -name '*.ts' -print | \
  node gitignore.js .myignore | \
  node es.ts