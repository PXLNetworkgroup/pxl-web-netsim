import subprocess, os

gcloud_path = r"C:\Users\PXL\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
env = os.environ.copy()
env['CLOUDSDK_PYTHON'] = r"C:\Users\PXL\AppData\Local\Programs\Python\Python312\python.exe"

try:
    res = subprocess.run([gcloud_path, "auth", "list"], capture_output=True, text=True, timeout=15, env=env)
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
except Exception as e:
    print("Error:", e)
