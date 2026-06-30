import sys

ss = sys.stdin.read()
lines=ss.splitlines()

for i in lines:
    if i == "\n":
        continue
    print(i, end="<br>")