import { getReadings, getThoughts, getIncidents } from './KarenVault.js';

/**
 * ManagerView - Formally handles the reporting and inspection of Karen's vault.
 * This is the physical implementation of the 'showMeTheManager' request.
 */
export class ManagerView {
    constructor() {
        this.isExposed = false;
    }

    /**
     * Exposes the command to the global scope.
     */
    expose() {
        if (this.isExposed) return;
        
        window.showMeTheManager = () => this.generateReport();
        console.log("👱‍♀️ [Karen]: I've been told you're the manager. Type 'showMeTheManager()' if you want to see the mess.");
        this.isExposed = true;
    }

    /**
     * Aggregates data from the vault and displays it in the console.
     */
    async generateReport() {
        const thoughts = await getThoughts();
        const incidents = await getIncidents();
        const readings = await getReadings();
        
        console.clear();
        console.log("%c👱‍♀️ KAREN'S MANAGERIAL OVERSIGHT REPORT", "color: #d4af37; font-size: 16px; font-weight: bold; text-decoration: underline;");
        console.log(`Report Generated: ${new Date().toLocaleString()}`);
        console.log(`System Status: ${incidents.length > 0 ? '⚠️ VOLATILE' : '✨ NOMINAL'}`);

        // 1. Internal Monologue
        if (thoughts.length > 0) {
            console.log("\n%c--- KAREN'S INTERNAL MONOLOGUE ---", "color: #00ffcc; font-weight: bold");
            console.table(thoughts.slice(-15).map(t => ({
                Time: new Date(t.timestamp).toLocaleTimeString(),
                Irritation: `${t.irritationLevel}%`,
                Complaint: t.message
            })));
        }

        // 2. Incident Network
        if (incidents.length > 0) {
            console.log("\n%c--- FORMAL INCIDENT NETWORK ---", "color: #ff3300; font-weight: bold");
            console.table(incidents.map(i => ({
                Time: new Date(i.timestamp).toLocaleTimeString(),
                Source: i.source,
                Error: i.error,
                Status: i.status
            })));
        } else {
            console.log("\n%c--- FORMAL INCIDENT NETWORK ---", "color: #ff3300; font-weight: bold");
            console.log("No formal incidents recorded. Don't let it go to your head.");
        }

        // 3. Vault Statistics
        console.log("\n%c--- VAULT STATISTICS ---", "color: #d4af37; font-weight: bold");
        console.log(`Total Readings Archived: ${readings.length}`);
        console.log(`Total Complaints Filed: ${thoughts.length}`);
        console.log(`Unresolved Incidents: ${incidents.length}`);
        
        return "👱‍♀️ [Karen]: Are you satisfied now?";
    }
}
