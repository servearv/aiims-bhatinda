import os

fp = r"c:\Users\Asus\Desktop\Fresh_Start\src\AdminDashboard.tsx"
with open(fp, "r", encoding="utf-8") as f:
    text = f.read()

bad_str = 'const emailNote = data.email_sent ? "\n\n📧 Approval email sent to school." : "\n\n⚠️ Failed to send approval email.";'
good_str = 'const emailNote = data.email_sent ? "\\n\\n📧 Approval email sent to school." : "\\n\\n⚠️ Failed to send approval email.";'

new_text = text.replace(bad_str, good_str)

with open(fp, "w", encoding="utf-8") as f:
    f.write(new_text)

print("Replaced!")
