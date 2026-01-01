
import subprocess
import os

def run_git(args, filename):
    with open(filename, 'a') as f:
        f.write(f"\n=== GIT {' '.join(args)} ===\n")
        try:
            result = subprocess.run(['git'] + args, capture_output=True, text=True)
            f.write(result.stdout)
            f.write(result.stderr)
        except Exception as e:
            f.write(str(e))

filename = 'git_python_diag.txt'
if os.path.exists(filename):
    os.remove(filename)

run_git(['status'], filename)
run_git(['branch', '-vv'], filename)
run_git(['log', '-1'], filename)
run_git(['remote', '-v'], filename)
