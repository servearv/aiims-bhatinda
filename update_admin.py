import re
import os

fp = r"c:\Users\Asus\Desktop\Fresh_Start\src\AdminDashboard.tsx"
with open(fp, "r", encoding="utf-8") as f:
    text = f.read()

target = r"setMessage\(\{ type: 'success', text: `✅ Approved! Event created \(ID: \$\{data.event_id\}\)` \}\);"
replacement = r"""const emailNote = data.email_sent ? "\n\n📧 Approval email sent to school." : "\n\n⚠️ Failed to send approval email.";
        setMessage({ type: 'success', text: `✅ Approved! Event created (ID: ${data.event_id})${emailNote}` });"""

new_text = re.sub(target, replacement, text)

with open(fp, "w", encoding="utf-8") as f:
    f.write(new_text)

print("Replaced!")
