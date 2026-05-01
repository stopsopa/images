set -e

cat <<EEE

  typechecking...

EEE

NODE_OPTIONS="" node_modules/.bin/tsc

cat <<EEE

  transpiling...

EEE

find . -path './node_modules' -prune -o -path './.git' -prune -o -type f -name '*.ts' -print | NODE_OPTIONS="" node gitignore.js .myignore | NODE_OPTIONS="" node es.ts