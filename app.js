async function loadJobTracker() {
    const container = document.getElementById('job-cards-container');
    
    try {
        // Fetch data from local json store
        const response = await fetch('./data.json');
        const jobs = await response.json();
        
        // Generate clean HTML templates dynamically
        container.innerHTML = jobs.map(job => {
            const isActive = job.status === 'Active';
            
            return `
                <div class="bg-slate-950 border ${isActive ? 'border-teal-500/30' : 'border-slate-800'} rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition duration-200">
                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-xs font-mono text-slate-500 uppercase tracking-widest">${job.id}</span>
                            <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${isActive ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-800 text-slate-400'}">
                                ${job.status}
                            </span>
                        </div>
                        <h3 class="text-xl font-bold text-white mb-2">${job.department}</h3>
                        <div class="space-y-1.5 text-sm mb-6">
                            <div class="flex justify-between"><span class="text-slate-500">Vacancies:</span> <span class="font-semibold text-slate-300">${job.vacancies}</span></div>
                            <div class="flex justify-between"><span class="text-slate-500">Timeline:</span> <span class="text-slate-300">${job.date}</span></div>
                        </div>
                    </div>
                    <a href="${job.link}" target="_blank" class="w-full text-center block py-2.5 px-4 rounded-xl font-medium text-sm transition ${isActive ? 'bg-teal-500 hover:bg-teal-600 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}">
                        ${isActive ? 'Apply / Verify Details ↗' : 'Notification Coming Soon'}
                    </a>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading tracker data:', error);
        container.innerHTML = `<p class="text-red-400 text-center col-span-full font-medium">Failed to load real-time updates. Please try again later.</p>`;
    }
}

document.addEventListener('DOMContentLoaded', loadJobTracker);