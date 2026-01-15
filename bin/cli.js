#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const FRAMEWORK_DIR = path.join(__dirname, '..', 'framework');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function print(msg, color = '') {
  console.log(`${color}${msg}${colors.reset}`);
}

function printBanner() {
  console.log(`
${colors.cyan}                       .:+*-.                                         .:+*-.                        
                      .*@@@@@%*:                                  ..+%@@@@@%:                       
                      +@@@@@@@@@%+.                             .-#@@@@@@@@@%.                      
                    .=%@@@@@@@@@@@@+.                         .-%@@@@@@@@@@@@#.                     
                   .*@@@@@@@@@@@@@@@@=.                     .:%@@@@@@@@@@@@@@@@-                    
                  .-:=*%%%#*-..=%@@@@@%:.                  .*@@@@@@*...+*#%%#+:-.                   
                 ..-%=....:-+=..:%@@@@@@@%+:..        ..-%@@@@@@@@#..-+-:....-#*..                  
             ..=@@%.=@#-+%@@-  .:@@@@@@@@@@@@%:.   ..#@@@@@@@@@@@@#.  .@@%*-*%%.+@@*..              
           .-@@@@@@@-*=.:=.   .*@@@@@@@@@@@@@@@#. .+@@@@@@@@@@@@@@@%:.  .:=.:*.*@@@@@@*.            
          .%@@@@@@@=.......  :#%@@@@@@@@@@@@@@@@%.-@@@@@@@@@@@@@@@@@%=. .......:@@@@@@@@=           
         .%@@@@@@@%:.          .%@@@@@@@@@@@@@@@%:#@@@@@@@@@@@@@@@@-          ..%@@@@@@@@:          
         =@@@@@@@@#::::=###*-..-@@@@@@@@@@@@@@@@%:*@@@@@@@@@@@@@@@@*. :*###*-:::-@@@@@@@@%.         
         *@@@@@@@@@#.        .=%@@@@@@@@@@@@@@@@#.-@@@@@@@@@@@@@@@@@#.        .=@@@@@@@@@%:         
        .%@@@@@@@@@@%+.    .+%@*%@@@@@@@@@@@@@@%: .#@@@@@@@@@@@@@@%*%@*..  ..-%@@@@@@@@@@@=         
        .%@@@@@@@@@@@@@@@@@@@%:%@@@@@@@@@@@@@@@= ...%@@@@@@@@@@@@@@@*#@@@@@@@@@@@@@@@@@@@@=         
        .%@@@@@@@@@@@@@@@@@@@-@@@@@@@@@@@@@@@@*..#=.-%@@@@@@@@@@@@@@@=+@@@@@@@@@@@@@@@@@@@=         
         #@@@@@@@@@@@@@@@@@%.#@@@@@@@@@@@@@@@# .#@%-.=@@@@@@@@@@@@@@@@=*@@@@@@@@@@@@@@@@@@-         
         +@@@@@@@@@@@@@@@@@-*@@@@@@@@@@@@@@@%:.*@@@@-.+@@@@@@@@@@@@@@@%.*@@@@@@@@@@@@@@@@%:         
         =@@@@@@@@@@@@@@@@=:%@@@@@@@@@@@@@@%:.*@@@@@%..#@@@@@@@@@@@@@@@+:@@@@@@@@@@@@@@@@%.         
         :%@@@@@@@@@@@@@@#.=@@@@@@@@@@@@@@@=.=@@@@@@@@:.#@@@@@@@@@@@@@@@.-@@@@@@@@@@@@@@@+          
         .%@@@@@@@@@@@@@@-.%@@@@@@@@@@@@@@=.=@@@@@@@@@#.:@@@@@@@@@@@@@@@=.#@@@@@@@@@@@@@@:          
          =@@@@@@@@@@@@@+ -@@@@@@@@@@@@@@*.-%@@@@@@@@@@%.:%@@@@@@@@@@@@@*.:@@@@@@@@@@@@@#.          
          .%@@@@@@@@@@@%..#@@@@@@@@@@@@@+..%@@@@@@@@@@@@=.:@@@@@@@@@@@@@%..-@@@@@@@@@@@@=           
           +@@@@@@@@@@@. .#@@@@@@@@@@@@#. :@@@@@@@@@@@@@*. -%@@@@@@@@@@@@: .#@@@@@@@@@@@.           
           :%@@@@@@@@@=  :%@@@@@@@@@@@*.  .*@@@@@@@@@@@%-  .:%@@@@@@@@@@@+. .%@@@@@@@@@=            
           .+@@@@@@@@%.  :%@@@@@@@@@@+.    .*@@@@@@@@@%:     :%@@@@@@@@@@#.  -@@@@@@@@#.            
            .#@@@@@@@=.  :@@@@@@@@@@+.      .*@@@@@@@@-       .%@@@@@@@@@#. .:%@@@@@@@=.            
             =@@@@@@@@@=.:%@@@@@@@@@#.       :@@@@@@@*.      .+@@@@@@@@@@#.:%@@@@@@@@#.             
             .:#%@@@@@@@-.:#@@@@@@@@@-       .%@@@@@@-       .%@@@@@@@@%+ .%@@@@@@@%+.              
${colors.reset}
${colors.bright}                        Dos Apes Super Agent Framework${colors.reset}
${colors.cyan}              "We ain't monkeying around with code!"${colors.reset}

   ${colors.yellow}GSD + VibeKanban + Ralph Wiggum + Claude Code Best Practices${colors.reset}
`);
}

function printSuccess() {
  console.log(`
${colors.green}╔═══════════════════════════════════════════════════════════════╗
║                                                                 ║
║   ✅ Installation Complete!                                     ║
║                                                                 ║
║   Verify: Start Claude Code and run /apes:help                  ║
║                                                                 ║
║   🦍🦍 Ready to ship!                                           ║
║                                                                 ║
╚═══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    print(`Warning: Source not found: ${src}`, colors.yellow);
    return;
  }

  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    // Don't overwrite existing files unless they're ours
    if (fs.existsSync(dest)) {
      const existingContent = fs.readFileSync(dest, 'utf8');
      if (!existingContent.includes('dos-apes') && !existingContent.includes('Dos Apes')) {
        print(`  Skipping (exists): ${dest}`, colors.yellow);
        return;
      }
    }
    fs.copyFileSync(src, dest);
    print(`  Created: ${dest}`, colors.green);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Check for non-interactive flags
  let installPath = null;
  let projectType = null;
  
  if (args.includes('--global') || args.includes('-g')) {
    installPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
  } else if (args.includes('--local') || args.includes('-l')) {
    installPath = path.join(process.cwd(), '.claude');
  }
  
  if (args.includes('--greenfield')) {
    projectType = 'greenfield';
  } else if (args.includes('--brownfield')) {
    projectType = 'brownfield';
  }

  printBanner();

  // Interactive mode if flags not provided
  if (!installPath) {
    print('Where would you like to install?', colors.cyan);
    print('  1. Global (~/.claude/) - Available in all projects');
    print('  2. Local (./.claude/) - This project only');
    print('');
    
    const choice = await prompt('Choose (1 or 2): ');
    
    if (choice === '1') {
      installPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
    } else {
      installPath = path.join(process.cwd(), '.claude');
    }
  }

  if (!projectType) {
    print('', colors.reset);
    print('What type of project?', colors.cyan);
    print('  1. Greenfield - Building something new from PRD');
    print('  2. Brownfield - Adding to existing codebase');
    print('');
    
    const choice = await prompt('Choose (1 or 2): ');
    projectType = choice === '1' ? 'greenfield' : 'brownfield';
  }

  print('', colors.reset);
  print(`Installing to: ${installPath}`, colors.blue);
  print(`Project type: ${projectType}`, colors.blue);
  print('', colors.reset);

  // Create directories
  const dirs = [
    installPath,
    path.join(installPath, 'commands'),
    path.join(installPath, 'agents'),
    path.join(installPath, 'hooks'),
    path.join(installPath, 'skills'),
    path.join(installPath, 'templates'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      print(`  Created directory: ${dir}`, colors.green);
    }
  }

  // Copy framework files
  print('', colors.reset);
  print('Installing framework files...', colors.cyan);
  
  // Copy commands
  copyRecursive(
    path.join(FRAMEWORK_DIR, 'commands'),
    path.join(installPath, 'commands')
  );

  // Copy agents
  copyRecursive(
    path.join(FRAMEWORK_DIR, 'agents'),
    path.join(installPath, 'agents')
  );

  // Copy hooks
  copyRecursive(
    path.join(FRAMEWORK_DIR, 'hooks'),
    path.join(installPath, 'hooks')
  );

  // Copy skills
  copyRecursive(
    path.join(FRAMEWORK_DIR, 'skills'),
    path.join(installPath, 'skills')
  );

  // Copy ORCHESTRATOR.md (the brain)
  copyRecursive(
    path.join(FRAMEWORK_DIR, 'ORCHESTRATOR.md'),
    path.join(installPath, 'ORCHESTRATOR.md')
  );

  // Copy templates
  copyRecursive(
    path.join(FRAMEWORK_DIR, 'templates'),
    path.join(installPath, 'templates')
  );

  // Copy settings.json if not exists
  const settingsPath = path.join(installPath, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    copyRecursive(
      path.join(FRAMEWORK_DIR, 'settings.json'),
      settingsPath
    );
  }

  // Create .planning directory for local installs
  if (installPath.includes(process.cwd())) {
    const planningDir = path.join(process.cwd(), '.planning');
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
      print(`  Created: ${planningDir}`, colors.green);
    }

    // Create initial STATE.md
    const statePath = path.join(planningDir, 'STATE.md');
    if (!fs.existsSync(statePath)) {
      const stateContent = `# State

## Current Position
- Phase: Not started
- Task: None
- Status: initialized

## Progress
No phases planned yet.

## Session Log
- ${new Date().toISOString()}: Dos Apes Super Agent Framework initialized (${projectType})
`;
      fs.writeFileSync(statePath, stateContent);
      print(`  Created: ${statePath}`, colors.green);
    }

    // For brownfield, remind to run map command
    if (projectType === 'brownfield') {
      print('', colors.reset);
      print('📋 Next step for brownfield project:', colors.yellow);
      print('   Run /apes:map to analyze your codebase', colors.yellow);
    }
  }

  // Make hooks executable
  const hooksDir = path.join(installPath, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hooks = fs.readdirSync(hooksDir);
    for (const hook of hooks) {
      if (hook.endsWith('.sh')) {
        const hookPath = path.join(hooksDir, hook);
        try {
          fs.chmodSync(hookPath, '755');
        } catch (e) {
          // Windows doesn't support chmod, that's ok
        }
      }
    }
  }

  printSuccess();

  print('Quick Start:', colors.cyan);
  print('', colors.reset);
  
  if (projectType === 'greenfield') {
    print('  1. Create your PRD document');
    print('  2. Run: /apes:init --prd your-prd.md');
    print('  3. Run: /apes:plan 1');
    print('  4. Run: /apes:execute 1 --ralph');
  } else {
    print('  1. Run: /apes:map');
    print('  2. Run: /apes:feature "Your feature description"');
    print('  3. Or: /apes:fix "Bug description"');
  }

  print('', colors.reset);
  print('Documentation: https://github.com/dos-apes/dos-apes', colors.blue);
  print('', colors.reset);
}

main().catch((err) => {
  console.error('Installation failed:', err);
  process.exit(1);
});
