
import subprocess
import os

log_file = 'commit_result.txt'

def run(args):
    try:
        res = subprocess.run(args, capture_output=True, text=True)
        with open(log_file, 'a') as f:
            f.write(f"\nCMD: {' '.join(args)}\n")
            f.write(f"STDOUT: {res.stdout}\n")
            f.write(f"STDERR: {res.stderr}\n")
            f.write(f"RET: {res.returncode}\n")
        return res.returncode
    except Exception as e:
        with open(log_file, 'a') as f:
            f.write(f"Review Error: {e}\n")
        return 1

if os.path.exists(log_file):
    os.remove(log_file)

run(['git', 'add', '--all'])
run(['git', 'status'])
run(['git', 'commit', '-m', "Finalize Single Player Mode - Auto-commit"])
run(['git', 'push', 'origin', 'HEAD'])
