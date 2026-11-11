import os

paths = [
    os.path.expanduser(r"~\AppData\Roaming\gcloud"),
    os.path.expanduser(r"~\.config\gcloud"),
    os.path.expanduser(r"~/.config/gcloud"),
]
for p in paths:
    print(p, "exists:", os.path.exists(p))
    if os.path.exists(p):
        for root, dirs, files in os.walk(p):
            print(" ", root, files)
