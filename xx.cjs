// to install go to: https://stopsopa.github.io//pages/bash/index.html#xx

// https://stopsopa.github.io/viewer.html?file=%2Fpages%2Fbash%2Fxx%2Fxx-template.cjs
// edit: https://github.com/stopsopa/stopsopa.github.io/blob/master/pages/bash/xx/xx-template.cjs

// 🚀 -
// ✅ -
// ⚙️  -
// 🗑️  -
// 🛑 -
// to call other xx commands from inside any xx command use:
//    shopt -s expand_aliases && source ~/.bashrc
// after that just do:
//   xx <command_name>

module.exports = (setup) => {
  return {
    help: {
      command: `
set -e  
# git config core.excludesFile .git/.gitignore_local


export NODE_OPTIONS=""
        
cat <<EEE

  🐙 GitHub: $(git ls-remote --get-url origin | awk '{\$1=\$1};1' | tr -d '\\n' | sed -E 's/git@github\\.com:([^/]+)\\/(.+)\\.git/https:\\/\\/github.com\\/\\1\\/\\2/g')

EEE

      `,
      description: "Status of all things",
      source: false,
      confirm: false,
    },
    server: {
      command: `
set -e      
export PPORT="5090" && echo -e "\n    http://localhost:\${PPORT} \n" && python3 -m http.server \${PPORT}
`,
      description: "Run local server",
      source: false,
      confirm: false,
    },
    build: {
      command: `
set -e  
/bin/bash build.sh
      `,
      description: "Build the extension",
      source: false,
      confirm: false,
    },
    tsc: {
      command: `
set -e  
NODE_OPTIONS="" node_modules/.bin/tsc

      `,
      description: "Transpile all .ts files",
      source: false,
      confirm: false,
    },
    transpile: {
      command: `
set -e  
export NODE_OPTIONS="";
find . -path './node_modules' -prune -o -path './.git' -prune -o -type f -name '*.ts' -print | node gitignore.js .myignore | node es.ts

      `,
      description: "Transpile all .ts files",
      source: false,
      confirm: false,
    },

    ...setup,
  };
};
