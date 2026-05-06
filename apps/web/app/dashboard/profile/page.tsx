"use client";

import { useEffect, useState } from "react";
import { User, Mail, Shield, Zap, CreditCard, Cpu, BarChart3, Save } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  role: string;
  aiQuotaUsage: number;
  aiQuotaMax: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would be an API call to /api/profile
    // For now we simulate the SQLite seed data
    setTimeout(() => {
      setProfile({
        id: 'alice',
        name: 'Alice Operator',
        role: 'Security Lead',
        aiQuotaUsage: 142,
        aiQuotaMax: 1000
      });
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
     return <div className="h-full flex items-center justify-center font-mono opacity-50 uppercase tracking-widest text-xs">Accessing profile buffer...</div>;
  }

  const usagePercent = profile ? Math.round((profile.aiQuotaUsage / profile.aiQuotaMax) * 100) : 0;

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">Identity Management</p>
          <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">Operator Profile</h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Manage your operational credentials and resource allocations.
          </p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-[14px] font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 shrink-0">
          <Save className="w-4 h-4" />
          Update Credentials
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* General Information */}
          <div className="ares-card p-8 bg-card border border-border whisper-shadow overflow-hidden relative">
             <div className="absolute top-0 right-0 p-8 opacity-[0.03] scale-150">
                <User className="w-32 h-32" />
             </div>
             <h3 className="text-lg font-serif font-bold mb-8 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Operational Identity
             </h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-2">
                   <label className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Full Name</label>
                   <div className="flex items-center gap-3 p-3 bg-secondary/10 rounded-xl border border-transparent hover:border-border transition-all">
                      <User className="w-4 h-4 text-primary" />
                      <input type="text" defaultValue={profile?.name} className="bg-transparent border-none p-0 focus:ring-0 text-[15px] font-medium w-full" />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Strategic Role</label>
                   <div className="flex items-center gap-3 p-3 bg-secondary/10 rounded-xl border border-transparent hover:border-border transition-all">
                      <Zap className="w-4 h-4 text-primary" />
                      <input type="text" defaultValue={profile?.role} className="bg-transparent border-none p-0 focus:ring-0 text-[15px] font-medium w-full" />
                   </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                   <label className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Contact Endpoint</label>
                   <div className="flex items-center gap-3 p-3 bg-secondary/10 rounded-xl border border-transparent hover:border-border transition-all">
                      <Mail className="w-4 h-4 text-primary" />
                      <input type="email" defaultValue="alice@ares.network" className="bg-transparent border-none p-0 focus:ring-0 text-[15px] font-medium w-full" />
                   </div>
                </div>
             </div>
          </div>

          {/* Infrastructure Context */}
          <div className="ares-card p-8 bg-card border border-border whisper-shadow">
             <h3 className="text-lg font-serif font-bold mb-8 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                Infrastructure Context
             </h3>
             
             <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/5 border border-border/50">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                         <Shield className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                         <p className="text-[14px] font-bold">Hardware Wallet</p>
                         <p className="text-[12px] text-muted-foreground font-mono">Ledger Nano X (Synced)</p>
                      </div>
                   </div>
                   <button className="text-[12px] font-bold text-primary hover:underline">Re-handshake</button>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/5 border border-border/50">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                         <BarChart3 className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                         <p className="text-[14px] font-bold">Node Affinity</p>
                         <p className="text-[12px] text-muted-foreground font-mono">Region: us-east-1 (Latency: 24ms)</p>
                      </div>
                   </div>
                   <button className="text-[12px] font-bold text-primary hover:underline">Select Region</button>
                </div>
             </div>
          </div>
        </div>

        {/* AI Resource Allocation */}
        <div className="space-y-8">
           <div className="ares-card p-8 bg-primary text-primary-foreground shadow-2xl shadow-primary/20">
              <h3 className="text-lg font-serif font-bold mb-8 flex items-center gap-2">
                 <Cpu className="w-4 h-4" />
                 AI Quota
              </h3>
              
              <div className="space-y-8">
                 <div className="space-y-3">
                    <div className="flex justify-between items-end">
                       <div>
                          <p className="text-[12px] uppercase tracking-widest font-mono font-bold opacity-70">Monthly Consumption</p>
                          <p className="text-3xl font-bold mt-1">{profile?.aiQuotaUsage.toLocaleString()} <span className="text-sm opacity-50 font-normal">/ {profile?.aiQuotaMax.toLocaleString()} tokens</span></p>
                       </div>
                       <span className="text-sm font-mono font-bold">{usagePercent}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-white transition-all duration-1000" 
                         style={{ width: `${usagePercent}%` }}
                       />
                    </div>
                 </div>

                 <div className="p-4 rounded-xl bg-white/10 border border-white/10 space-y-2">
                    <p className="text-[13px] leading-relaxed opacity-90">
                       You are currently on the <span className="font-bold underline">Operator Tier</span>. Pro-rated tokens refresh in 12 days.
                    </p>
                 </div>

                 <button className="w-full py-3 bg-white text-primary rounded-xl text-[14px] font-bold hover:bg-[#faf9f5] transition-all flex items-center justify-center gap-2 shadow-lg">
                    <Zap className="w-4 h-4" />
                    Scale Allocation
                 </button>
              </div>
           </div>

           <div className="ares-card p-8 bg-card border border-border whisper-shadow">
              <h3 className="text-lg font-serif font-bold mb-6 flex items-center gap-2">
                 <CreditCard className="w-4 h-4 text-primary" />
                 Billing Buffer
              </h3>
              <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
                 All security operations are billed in USDC on the ARES settlement layer.
              </p>
              <div className="p-4 rounded-xl bg-secondary/5 border border-dashed border-border mb-6">
                 <p className="text-[12px] text-muted-foreground font-mono mb-1">Settlement Balance</p>
                 <p className="text-2xl font-bold">248.50 USDC</p>
              </div>
              <button className="w-full py-3 border border-border rounded-xl text-[14px] font-bold hover:bg-secondary/5 transition-all">
                 Refill Buffer
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
