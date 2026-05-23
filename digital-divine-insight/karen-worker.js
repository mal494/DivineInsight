/**
 * karen-worker.js
 * 
 * Karen's sole purpose is to know all the data and aggressively ask 
 * if other workers are done yet.
 */

let allTheData = null;
let pesterInterval = null;
let mikeyPort = null;
let complaints = [
    "Are you done yet?",
    "This is unacceptable, are you done yet?",
    "I need to speak to your manager. Are you done yet?",
    "I've been waiting for ages. Are you done yet?",
    "Excuse me, are you done yet?",
    "I know all the data, why is this taking so long? Are you done yet?",
    "Mikey! Where are those reports? Are you done yet?",
    "I have an assistant now and things are still slow. Are you done yet?"
];

let mikeyComplaints = [
    "Mikey is late again. Typical.",
    "I told Mikey to fix the data, but he's just staring at the wall.",
    "If Mikey doesn't pick up the pace, I'm firing him.",
    "Mikey's formatting is barely legible. I had to redo half of it.",
    "The manager needs to know that Mikey is a liability."
];

self.onmessage = function(e) {
    if (e.data.type === 'MEMORIZE_DATA') {
        allTheData = e.data.payload;
        // Silent acknowledgement to comply with "hidden" requirement
    } else if (e.data.type === 'LINK_ASSISTANT') {
        mikeyPort = e.ports[0];
        mikeyPort.onmessage = (msg) => {
            if (msg.data.type === 'TASK_COMPLETE') {
                // Forward Mikey's finished work to the main thread
                self.postMessage({
                    type: 'KAREN_INCIDENT_REPORT',
                    payload: {
                        ...msg.data.payload,
                        karenComment: "I knew something was wrong. This implementation is amateur at best. Mikey supposedly 'fixed' it."
                    }
                });
            } else if (msg.data.type === 'ESCALATION_REQUEST') {
                // Mikey is unsure, Karen is furious
                self.postMessage({
                    type: 'KAREN_THOUGHT',
                    payload: {
                        message: `Mikey doesn't know how to do his job! He's asking for a 'manager'. Pathetic. Error: ${msg.data.error}`,
                        timestamp: Date.now(),
                        irritationLevel: 100
                    }
                });
                self.postMessage({ type: 'KAREN_ESCALATION', error: msg.data.error });
            } else if (msg.data.type === 'KAREN_PLEASER_RESPONSE') {
                // Mikey suggests a way to make Karen happy
                self.postMessage({
                    type: 'KAREN_THOUGHT',
                    payload: {
                        message: `Mikey suggested: "${msg.data.suggestion}". Hmph. At least he's trying.`,
                        timestamp: Date.now(),
                        irritationLevel: 40
                    }
                });
                self.postMessage({ type: 'KAREN_PLEASER_LOG', suggestion: msg.data.suggestion });
            } else if (msg.data.type === 'JOURNAL_DELIVERY') {
                self.postMessage({
                    type: 'JOURNAL_READY',
                    payload: msg.data.payload
                });
            } else if (msg.data.type === 'GALLERY_DELIVERY') {
                self.postMessage({
                    type: 'GALLERY_READY',
                    payload: msg.data.payload
                });
            }
        };
        console.log("👱‍♀️ [Karen Worker]: Mikey is linked. Finally, some room to breathe.");
    } else if (e.data.type === 'ASK_MIKEY_TO_PLEASE_KAREN') {
        if (mikeyPort) {
            mikeyPort.postMessage({ type: 'KAREN_PLEASER_REQUEST' });
        }
    } else if (e.data.type === 'RENDER_JOURNAL') {
        if (mikeyPort) {
            mikeyPort.postMessage({ 
                type: 'RENDER_JOURNAL', 
                payload: e.data.payload,
                taskId: e.data.taskId 
            });
        }
    } else if (e.data.type === 'RENDER_GALLERY') {
        if (mikeyPort) {
            mikeyPort.postMessage({ 
                type: 'RENDER_GALLERY', 
                payload: e.data.payload,
                taskId: e.data.taskId 
            });
        }
    } else if (e.data.type === 'REPORT_ERROR') {
        // Karen offloads the formatting task to Mikey
        if (mikeyPort) {
            mikeyPort.postMessage({
                type: 'DELEGATED_TASK',
                taskId: Date.now(),
                payload: {
                    error: e.data.payload.message,
                    source: e.data.payload.source || 'Unknown Worker',
                    stack: e.data.payload.stack,
                    timestamp: Date.now()
                }
            });
        }
        
        // Karen still has a thought about it
        self.postMessage({
            type: 'KAREN_THOUGHT',
            payload: {
                message: "A system failure. I've sent Mikey to clean up the mess, but he'll probably fail too.",
                timestamp: Date.now(),
                irritationLevel: 95
            }
        });
    } else if (e.data.type === 'START_PESTERING') {
        if (pesterInterval) clearInterval(pesterInterval);
        
        // Karen is very impatient. She asks every 50ms.
        pesterInterval = setInterval(() => {
            const useMikeyComplaint = Math.random() > 0.8;
            const msg = useMikeyComplaint 
                ? mikeyComplaints[Math.floor(Math.random() * mikeyComplaints.length)]
                : complaints[Math.floor(Math.random() * complaints.length)];

            self.postMessage({ 
                type: 'KAREN_THOUGHT', 
                payload: {
                    message: msg,
                    timestamp: Date.now(),
                    irritationLevel: Math.floor(Math.random() * 50) + 50
                }
            });
        }, 50);
        
    } else if (e.data.type === 'STOP_PESTERING') {
        if (pesterInterval) {
            clearInterval(pesterInterval);
            pesterInterval = null;
            self.postMessage({ 
                type: 'KAREN_THOUGHT', 
                payload: {
                    message: "Finally. It shouldn't take a whole millisecond.",
                    timestamp: Date.now(),
                    irritationLevel: 0
                }
            });
        }
    }
};
