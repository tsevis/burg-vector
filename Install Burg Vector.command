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
ext_dir='/Library/Application Support/Adobe/CEP/extensions'
manifest='CSXS/manifest.xml'
# The first prototype could remain discoverable under the same panel ID after upgrading.
# Retire only that exact manifest, and only after the new files are in place.
old="$ext_dir/Vector Effects/$manifest"
if [[ -f "$old" && "$(shasum -a 256 "$old" | cut -d' ' -f1)" == 'ff49123d58717d3dd23ea4e7e747b52363127757f74c1b8f58c206c5778d10e2' ]]; then
  if [[ -f "$ext_dir/Burg Vector/$manifest" ]] && cmp -s "$ext_dir/Burg Vector/$manifest" <(unzip -p "$project_dir/Burg Vector.zxp" "$manifest"); then
    mv -n "$old" "$old.disabled-by-burg-vector"
    if [[ -f "$old" ]]; then
      print -u2 'The old Vector Effects panel is still enabled. Its manifest needs to be moved aside.'
      exit 1
    fi
  fi
fi
print 'Reopen Illustrator, then choose Window > Extensions > Burg Vector.'
