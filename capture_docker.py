import subprocess

try:
    print("Starting docker compose build...")
    result = subprocess.run(
        ["docker", "compose", "build", "--no-cache"],
        capture_output=True,
        text=True,
        timeout=120
    )
    with open("docker_build_output.txt", "w", encoding="utf-8") as f:
        f.write("STDOUT:\n")
        f.write(result.stdout)
        f.write("\nSTDERR:\n")
        f.write(result.stderr)
        f.write(f"\nRETURN CODE: {result.returncode}\n")
    print("Done. Check docker_build_output.txt")
except Exception as e:
    with open("docker_build_output.txt", "w", encoding="utf-8") as f:
        f.write(f"Exception: {e}")
    print(f"Exception: {e}")
