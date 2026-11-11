import subprocess

git_path = r"C:\Users\PXL\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe"
res = subprocess.run([git_path, "--no-pager", "log", "-n", "10", "--oneline", "static/js/cisco_cli.js"], capture_output=True, text=True)
print(res.stdout)
