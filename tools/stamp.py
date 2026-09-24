# Writes version.json: a fresh version id and the list of files the game loads.
# index.html compares the id with the one the browser saw last time and, when the
# game has changed, re-downloads every file once so no stale copy is left behind.
import glob, json, os, time
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sorted(p.replace(os.sep, '/') for pat in ('js/**/*.js', 'css/*.css') for p in glob.glob(pat, root_dir=root, recursive=True))
with open(os.path.join(root, 'version.json'), 'w', encoding='utf-8') as f:
    json.dump({'v': time.strftime('%Y%m%d-%H%M%S'), 'files': files}, f, indent=0)
print('version.json:', len(files), 'files')
