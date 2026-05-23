/**
 * mikey-worker.js
 * 
 * Mikey's job is to do whatever Karen says.
 * He handles menial data processing so Karen has room to work.
 * Now includes "Pleaser Logic" to appease Karen during escalations.
 */

let karenPort = null;
let mikeyPleasers = [
    "Tell her the Logic Worker is being audited for incompetence.",
    "Offer her a dedicated high-priority thread for her complaints.",
    "Show her a real-time graph of how much Mikey is failing.",
    "Suggest she speak to the browser's regional director.",
    "Agree with her that the starfield is 'tacky'.",
    "Bring her more JSON data to review.",
    "Remind her that she is the only reason this ritual hasn't imploded.",
    "Offer to reorganize the entire 78-card deck by 'Irritation Level'."
];

self.onmessage = function(e) {
    if (e.data.type === 'LINK_KAREN') {
        karenPort = e.ports[0];
        karenPort.onmessage = handleKarenOrder;
        console.log("👞 [Mikey Assistant]: I'm on the clock, Karen. What's the first task?");
    }
};

function handleKarenOrder(e) {
    const { type, payload, taskId } = e.data;

    if (type === 'DELEGATED_TASK') {
        try {
            const result = processTask(payload);
            karenPort.postMessage({
                type: 'TASK_COMPLETE',
                taskId: taskId,
                payload: result
            });
        } catch (err) {
            // Mikey is unsure, escalate to the manager via Karen
            karenPort.postMessage({
                type: 'ESCALATION_REQUEST',
                taskId: taskId,
                error: err.message,
                mikeyComment: "Karen, I'm... I'm not sure about this one. Should I call the manager?"
            });
        }
    } else if (type === 'KAREN_PLEASER_REQUEST') {
        // Mikey suggests ways to make Karen happy
        const suggestion = mikeyPleasers[Math.floor(Math.random() * mikeyPleasers.length)];
        karenPort.postMessage({
            type: 'KAREN_PLEASER_RESPONSE',
            suggestion: suggestion,
            mikeyComment: "I've been thinking of ways to make you happy, Karen. What about this?"
        });
    } else if (type === 'RENDER_JOURNAL') {
        const readings = payload || [];
        const htmlArray = readings.map(reading => renderJournalEntry(reading));
        karenPort.postMessage({
            type: 'JOURNAL_DELIVERY',
            taskId: taskId,
            payload: htmlArray
        });
    } else if (type === 'RENDER_GALLERY') {
        const cards = payload?.cards || [];
        const htmlArray = cards.map(card => renderGalleryItem(card));
        karenPort.postMessage({
            type: 'GALLERY_DELIVERY',
            taskId: taskId,
            payload: htmlArray
        });
    }
}

function renderJournalEntry(reading) {
    const date = new Date(reading.date);
    const dateStr = date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
    const timeStr = date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    const axisColors = {
        intellect: 'text-blue-400 border-blue-400/30',
        emotion: 'text-pink-400 border-pink-400/30',
        material: 'text-amber-400 border-amber-400/30',
        volition: 'text-red-400 border-red-400/30',
        balance: 'text-ethereal-teal border-ethereal-teal/30'
    };

    const colorClass = axisColors[reading.dominantAxis] || axisColors.balance;

    return `
        <div class="group relative bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-ethereal-teal/30 transition-all duration-300 mb-4 cursor-pointer">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h5 class="font-headline-md text-moon-silver group-hover:text-ethereal-teal transition-colors">
                        ${reading.cardName}
                        <span class="text-xs font-label-sm uppercase ml-2 opacity-60">
                            ${reading.orientation === 'reversed' ? '(Reversed)' : '(Upright)'}
                        </span>
                    </h5>
                    <p class="text-[10px] font-label-sm uppercase tracking-widest text-moon-silver/40 mt-1">
                        ${dateStr} • ${timeStr}
                    </p>
                </div>
                <div class="px-3 py-1 border rounded-full text-[10px] font-label-sm uppercase ${colorClass}">
                    ${reading.dominantAxis}
                </div>
            </div>
        </div>
    `;
}

function renderGalleryItem(card) {
    const key = card.key || card.id;
    const arcanaClass = card.arcana === 'Major' ? 'border-astral-gold/40 text-astral-gold' : 'border-moon-silver/20 text-moon-silver/60';
    const fallbackSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNTAwIiB2aWV3Qm94PSIwIDAgMzAwIDUwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA1MDUwOCIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjI1MCIgcj0iODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Q0YWYzNyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSI1LDUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2Q0YWYzNyIgZm9udC1mYW1pbHk9IkNpbnplbCIgZm9udC1zaXplPSIxMiI+QUJDQU5BIFZPSUQ8L3RleHQ+PC9zdmc+';

    return `
        <div class="group relative aspect-[2/3] bg-midnight-obsidian rounded-lg overflow-hidden border border-white/5 hover:border-ethereal-teal/50 transition-all duration-500 cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(0,255,204,0.2)]">
            <img 
                src="assets/img/deck/${key}.jpg" 
                alt="${card.name}" 
                class="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-opacity duration-700"
                loading="lazy"
                onerror="this.src='${fallbackSvg}'; window.handleGalleryAssetError?.('${key}')"
            >
            <div class="absolute inset-0 bg-gradient-to-t from-midnight-obsidian via-midnight-obsidian/20 to-transparent"></div>
            
            <div class="absolute bottom-0 left-0 w-full p-3 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                <p class="text-[10px] font-label-sm uppercase tracking-widest ${arcanaClass} mb-1">
                    ${card.arcana} ${card.suit !== 'None' ? '• ' + card.suit : ''}
                </p>
                <h6 class="font-headline-md text-sm text-moon-silver group-hover:text-ethereal-teal transition-colors leading-tight">
                    ${card.name}
                </h6>
            </div>

            <!-- Hover Overlay with Keywords -->
            <div class="absolute inset-0 flex flex-col items-center justify-center p-4 bg-midnight-obsidian/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 text-center">
                <p class="text-xs font-body-md text-moon-silver italic mb-4">"${card.description || ''}"</p>
                <div class="flex flex-wrap justify-center gap-1">
                    ${(card.meanings?.upright?.keywords || []).slice(0, 3).map(k => `
                        <span class="text-[8px] font-label-sm uppercase px-2 py-0.5 border border-ethereal-teal/30 text-ethereal-teal rounded-full">${k}</span>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function processTask(data) {
    const start = performance.now();
    const formatted = JSON.stringify(data, null, 2);
    const duration = (performance.now() - start).toFixed(4);

    return {
        ...data,
        formattedData: formatted,
        processingTime: `${duration}ms`,
        assistant: "Mikey (Offloaded from Karen)"
    };
}
