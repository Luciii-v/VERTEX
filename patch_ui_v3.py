import re
import os

# Find the active js file
with open('frontend/vertex_mac/dist/index.html', 'r') as f:
    html_content = f.read()

match = re.search(r'assets/(index-[A-Za-z0-9_]+\.js)', html_content)
if not match:
    print("❌ Could not find JS file in index.html")
    exit(1)

js_filename = match.group(1)
js_path = f'frontend/vertex_mac/dist/assets/{js_filename}'
print(f"Active JS file: {js_filename}")

with open(js_path, 'r') as f:
    content = f.read()

# Define replacement
inject = """
window.streamFromBackend = async (query, msgId, updateFn) => {
    try {
        const res = await fetch("http://127.0.0.1:8000/investigate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User": typeof t === 'function' ? t().userName : "demo",
                "X-Role": "engineer"
            },
            body: JSON.stringify({ query: query })
        });
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let logs = "";
        let finalAnswer = null;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split("\\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.type === "log") {
                            logs += data.content + "\\n";
                            updateFn(logs, finalAnswer);
                        } else if (data.type === "result") {
                            finalAnswer = data.content;
                            updateFn(logs, finalAnswer);
                        } else if (data.type === "error") {
                            updateFn(logs + "\\nERROR: " + data.content, finalAnswer);
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (e) {
        updateFn("Error connecting to backend.", null);
    }
};
"""

new_sendMessage = """sendMessage:(r,n)=>{
    if(!r.trim()&&(!n||n.length===0))return;
    const l=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    const a=`msg-user-${Date.now()}`;
    const i=n&&n.length>0?`\\n\\n*[Attached: ${n.map(y=>y.name).join(", ")}]*`:"";
    const fullQuery = r+i;
    const o={id:a,sender:"user",content:fullQuery,timestamp:l};
    e(y=>({messages:[...y.messages,o]}));
    const u=`msg-agent-${Date.now()}`;
    const m={id:u,sender:"agent",content:"Initializing inference...",timestamp:l,isStreaming:!0,progressPercent:15,progressSubStep:"Starting..."};
    e(y=>({messages:[...y.messages,m]}));
    if(!window.streamFromBackend){ 
        %INJECT%
    }
    window.streamFromBackend(fullQuery, u, (logs, finalAnswer) => {
        e(y => ({
            messages: y.messages.map(x => {
                if (x.id === u) {
                    if (finalAnswer !== null) {
                        return { ...x, isStreaming: false, content: finalAnswer };
                    } else {
                        return { ...x, content: `**Thinking...**\\n\\`\\`\\`text\\n${logs}\\n\\`\\`\\`` };
                    }
                }
                return x;
            })
        }));
    });
},approveAction:"""

new_sendMessage = new_sendMessage.replace("%INJECT%", inject)

start_idx = content.find('sendMessage:(r,n)=>{')
end_idx = content.find('approveAction:', start_idx)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_sendMessage + content[end_idx + len('approveAction:'):]
    with open(js_path, 'w') as f:
        f.write(content)
    print("✅ Patched UI sendMessage in active file")
else:
    print("❌ Could not find sendMessage to patch")
