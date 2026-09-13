import sys
import argparse
from tools.orchestrator import run_orchestrator
from tools.agent import run as run_agent

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", action="append", dest="images", help="Attach an image to the chat")
    args = parser.parse_args()

    print("========================================")
    print(" VERTEX AI WORKBENCH - INTERACTIVE CHAT ")
    print("========================================")
    print("Type 'exit' to quit. Use 'orchestrate: <task>' to trigger the full multi-agent pipeline.\n")
    if args.images:
        print(f"Attached images: {args.images}\n")
    
    while True:
        try:
            task = input("🧑‍💻 You: ")
            if not task.strip(): continue
            if task.lower() in ("exit", "quit"): break
            
            if task.lower().startswith("orchestrate:"):
                task = task.split("orchestrate:", 1)[1].strip()
                run_orchestrator(task, verbose=True)
            else:
                run_agent(task, images=args.images, verbose=True)
            print("\n")
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Error: {e}\n")

if __name__ == "__main__":
    main()
