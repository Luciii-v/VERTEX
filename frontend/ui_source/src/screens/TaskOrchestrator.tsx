import React, { useState, useEffect, useRef } from 'react';
import { Activity, Play, Pause, RefreshCw, CheckCircle, FileText, Send } from 'lucide-react';
import { useStore } from '../store/useStore';

export const TaskOrchestrator: React.FC = () => {
  const { userName, settings } = useStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [objective, setObjective] = useState('');
  const [activeTask, setActiveTask] = useState<any | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/tasks', {
        headers: { 'X-User': userName, 'X-Role': 'engineer' }
      });
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim()) return;
    
    setLoading(true);
    setLogs('Planning task...\n');
    try {
      const res = await fetch('http://127.0.0.1:8000/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User': userName,
          'X-Role': 'engineer'
        },
        body: JSON.stringify({ objective })
      });
      const data = await res.json();
      setObjective('');
      await fetchTasks();
      setActiveTask(data);
      
      // Automatically resume the task after creation to start processing
      resumeTask(data.task_id);
    } catch (e) {
      setLogs(prev => prev + '\nError creating task.');
      setLoading(false);
    }
  };

  const resumeTask = async (taskId: string) => {
    setLoading(true);
    setLogs(prev => prev + `\nResuming task ${taskId}...\n`);
    try {
      const res = await fetch('http://127.0.0.1:8000/tasks/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User': userName,
          'X-Role': 'engineer'
        },
        body: JSON.stringify({ task_id: taskId })
      });
      
      if (!res.ok) {
        setLogs(prev => prev + `\nError: HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      
      const reader = res.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        let parts = buffer.split("\n");
        buffer = parts.pop() || "";
        
        for (let part of parts) {
          if (!part.startsWith("data: ")) continue;
          const jsonStr = part.replace("data: ", "").trim();
          if (!jsonStr) continue;
          
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === "log") {
              setLogs(prev => prev + data.content + "\n");
            } else if (data.type === "result") {
              setLogs(prev => prev + "\nFINAL RESULT:\n" + (typeof data.content === "object" ? JSON.stringify(data.content, null, 2) : data.content) + "\n");
            } else if (data.type === "error") {
              setLogs(prev => prev + "\nERROR:\n" + data.content + "\n");
            }
          } catch (err) {}
        }
      }
    } catch (e) {
      setLogs(prev => prev + '\nConnection lost.');
    }
    setLoading(false);
    fetchTasks();
  };

  return (
    <div className="flex h-full w-full bg-base font-mono overflow-hidden">
      {/* Sidebar: Task List */}
      <div className="w-1/3 max-w-sm border-r border-border bg-panel flex flex-col">
        <div className="p-4 border-b border-border bg-black/20">
          <h2 className="text-sm font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Task Orchestrator
          </h2>
          <p className="text-[10px] text-textSecondary mt-1">LONG-HORIZON AUTONOMY</p>
        </div>
        
        <div className="p-4 border-b border-border">
          <form onSubmit={createTask} className="flex gap-2">
            <input 
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="e.g. Analyze pump vibration..."
              className="flex-1 bg-base border border-border text-xs px-3 py-2 text-textPrimary placeholder:text-textSecondary/50 outline-none focus:border-emerald-500/50"
            />
            <button disabled={loading || !objective.trim()} type="submit" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-2 disabled:opacity-50 hover:bg-emerald-500/20 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="text-xs text-textSecondary text-center py-10">No tasks created yet.</div>
          ) : (
            tasks.map(task => (
              <button 
                key={task.task_id}
                onClick={() => { setActiveTask(task); setLogs(`Viewing task ${task.task_id}\nStatus: ${task.status}\n\n`); }}
                className={`w-full text-left p-3 border rounded transition-colors ${activeTask?.task_id === task.task_id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-base border-border hover:border-textSecondary/30'}`}
              >
                <div className="text-xs text-textPrimary font-bold truncate mb-1">{task.objective}</div>
                <div className="flex justify-between items-center text-[10px] text-textSecondary uppercase tracking-wider">
                  <span>{task.task_id.substring(0,6)}</span>
                  <span className={`px-1.5 py-0.5 rounded border ${task.status === 'completed' ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' : task.status === 'failed' ? 'text-red-400 border-red-400/20 bg-red-400/10' : 'text-amber-400 border-amber-400/20 bg-amber-400/10'}`}>
                    {task.status}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Panel: Task Details & Logs */}
      <div className="flex-1 flex flex-col bg-base relative">
        {activeTask ? (
          <>
            <div className="h-16 shrink-0 border-b border-border bg-panel flex items-center justify-between px-6">
              <div>
                <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wider">Task: {activeTask.task_id}</h3>
                <p className="text-[11px] text-textSecondary truncate max-w-xl">{activeTask.objective}</p>
              </div>
              
              <div className="flex gap-3">
                {activeTask.status !== 'completed' && (
                  <button 
                    onClick={() => resumeTask(activeTask.task_id)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider rounded hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Resume / Tail Logs
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-black/40">
              <div className="mb-4 p-3 bg-panel border border-border rounded text-xs text-textPrimary">
                <div className="font-bold mb-1 opacity-70">OBJECTIVE</div>
                <div className="line-clamp-3 text-textSecondary">{activeTask.objective}</div>
              </div>
              <pre className="text-xs text-textSecondary font-mono whitespace-pre-wrap">
                {logs || 'No logs available.'}
                <div ref={logsEndRef} />
              </pre>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-textSecondary">
            <Activity className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm uppercase tracking-widest">Select or create a task</p>
          </div>
        )}
      </div>
    </div>
  );
};
