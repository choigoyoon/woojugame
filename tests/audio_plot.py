"""Review plots of the exported production audio. Run after audio_audit.py."""
import json, wave
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from browser_support import OUTPUT

out=OUTPUT/'audio-audit'
groups={'soundtracks':['lobby-all','stairs-all','battle-all','runner-all','plaza-all'],
        'safety':['battle-overload','calm-musicbox','background-silence','mode-transitions','effects-showcase','harbor-effects']}
for group,names in groups.items():
    fig,axes=plt.subplots(len(names),2,figsize=(14,len(names)*2.4),layout='constrained')
    fig.suptitle('UJU BLOCK ARCADE | '+group.upper()+' | 44.1 kHz production output',fontsize=15)
    for row,name in enumerate(names):
        with wave.open(str(out/(name+'.wav')),'rb') as f:
            rate=f.getframerate();samples=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
        # Show min/max per 10 ms bin, preserving transients instead of aliasing a decimated waveform.
        bins=samples[:len(samples)//441*441].reshape(-1,441);t=np.arange(len(bins))*.01
        ax=axes[row,0];ax.fill_between(t,bins.min(axis=1),bins.max(axis=1),color='#377eb8',alpha=.8)
        ax.plot(t,np.sqrt(np.mean(bins*bins,axis=1)),color='#e28413',lw=1,label='10 ms RMS')
        ax.set(title=name,ylabel='Amplitude',ylim=(-1,1),xlabel='Seconds');ax.grid(alpha=.15);ax.legend(loc='upper right',fontsize=8)
        index=int(np.argmax(np.abs(np.diff(samples))));lo=max(0,index-220);hi=min(len(samples),index+221)
        axes[row,1].plot(np.arange(lo,hi)/rate*1000,samples[lo:hi],color='#2a7f62',lw=1)
        axes[row,1].set(title='10 ms around greatest adjacent-sample change',xlabel='Milliseconds',ylabel='Amplitude',ylim=(-1,1));axes[row,1].grid(alpha=.15)
    fig.savefig(out/(group+'-waveforms.png'),dpi=120);plt.close(fig)
print('Wrote soundtrack and safety waveform review plots')
