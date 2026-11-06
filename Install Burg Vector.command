#!/bin/zsh
set -eu
project_dir="${0:A:h}"
agent_dir='/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent'
agent="$agent_dir/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent"
if [[ ! -x "$agent" ]]; then
  agent="$agent_dir/UnifiedPluginInstallerAgent"
fi
if [[ ! -x "$agent" ]]; then
  print -u2 'Open Creative Cloud Desktop and update it to install the Adobe plug-in installer.'
  exit 1
fi
"$agent" --install "$project_dir/Burg Vector.zxp"
print 'Reopen Illustrator, then choose Window > Extensions > Burg Vector.'
