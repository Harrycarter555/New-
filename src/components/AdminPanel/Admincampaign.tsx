import React, { useState } from 'react';
import { campaignService } from './firebaseService';
import { ICONS } from '../../utils/constants';

interface AdminCampaignsProps {
  campaigns: any[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: any;
}

const AdminCampaigns: React.FC<AdminCampaignsProps> = ({ campaigns, showToast, currentUser }) => {
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    videoUrl: '',
    thumbnailUrl: '',
    caption: '',
    hashtags: '#viral #trending',
    audioName: '',
    goalViews: 20000,
    goalLikes: 2500,
    basicPay: 50,
    viralPay: 250,
    bioLink: ''
  });
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [videoBase64, setVideoBase64] = useState('');
  const [thumbBase64, setThumbBase64] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'thumb') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'video') {
        setVideoBase64(reader.result as string);
        if (editingCampaign) {
          setEditingCampaign({...editingCampaign, videoUrl: reader.result as string});
        } else {
          setNewCampaign({...newCampaign, videoUrl: reader.result as string});
        }
      } else {
        setThumbBase64(reader.result as string);
        if (editingCampaign) {
          setEditingCampaign({...editingCampaign, thumbnailUrl: reader.result as string});
        } else {
          setNewCampaign({...newCampaign, thumbnailUrl: reader.result as string});
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.title || !newCampaign.caption || !newCampaign.audioName) {
      showToast('Title, caption and audio name are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const finalVideoUrl = videoBase64 || newCampaign.videoUrl;
      const finalThumbUrl = thumbBase64 || newCampaign.thumbnailUrl;

      await campaignService.createCampaign({
        title: newCampaign.title,
        videoUrl: finalVideoUrl,
        thumbnailUrl: finalThumbUrl,
        caption: newCampaign.caption,
        hashtags: newCampaign.hashtags,
        audioName: newCampaign.audioName,
        goalViews: newCampaign.goalViews,
        goalLikes: newCampaign.goalLikes,
        basicPay: newCampaign.basicPay,
        viralPay: newCampaign.viralPay,
        active: true,
        bioLink: newCampaign.bioLink
      }, currentUser.id);

      showToast(`Campaign "${newCampaign.title}" launched successfully`, 'success');
      
      // Reset form
      setNewCampaign({
        title: '',
        videoUrl: '',
        thumbnailUrl: '',
        caption: '',
        hashtags: '#viral #trending',
        audioName: '',
        goalViews: 20000,
        goalLikes: 2500,
        basicPay: 50,
        viralPay: 250,
        bioLink: ''
      });
      setVideoBase64('');
      setThumbBase64('');
    } catch (error: any) {
      showToast(error.message || 'Failed to create campaign', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;

    setLoading(true);
    try {
      await campaignService.updateCampaign(editingCampaign.id, {
        title: editingCampaign.title,
        videoUrl: editingCampaign.videoUrl,
        thumbnailUrl: editingCampaign.thumbnailUrl,
        caption: editingCampaign.caption,
        hashtags: editingCampaign.hashtags,
        audioName: editingCampaign.audioName,
        goalViews: editingCampaign.goalViews,
        goalLikes: editingCampaign.goalLikes,
        basicPay: editingCampaign.basicPay,
        viralPay: editingCampaign.viralPay,
        bioLink: editingCampaign.bioLink
      });

      showToast(`Campaign "${editingCampaign.title}" updated successfully`, 'success');
      setEditingCampaign(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to update campaign', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaignStatus = async (campaignId: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      await campaignService.toggleCampaignStatus(campaignId, currentStatus);
      showToast(`Campaign ${!currentStatus ? 'activated' : 'suspended'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update campaign status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteCampaign = async (campaignId: string, campaignTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${campaignTitle}"?`)) return;
    
    setLoading(true);
    try {
      await campaignService.deleteCampaign(campaignId);
      showToast('Campaign deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete campaign', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-8 animate-slide">
      {/* Create/Edit Campaign Form */}
      <div className="glass-panel p-8 rounded-[40px] space-y-6 border-t-4 border-cyan-500 shadow-2xl">
        <h3 className="text-xl font-black text-white italic uppercase">
          {editingCampaign ? 'Update Mission' : 'New Mission Launch'}
        </h3>
        
        <form onSubmit={editingCampaign ? handleUpdateCampaign : handleCreateCampaign} className="space-y-4">
          <input
            type="text"
            placeholder="TARGET MISSION TITLE"
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-cyan-500 transition-all shadow-inner"
            value={editingCampaign?.title || newCampaign.title}
            onChange={(e) => editingCampaign 
              ? setEditingCampaign({...editingCampaign, title: e.target.value})
              : setNewCampaign({...newCampaign, title: e.target.value})
            }
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="VIDEO URL (MP4)"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white shadow-inner"
                value={editingCampaign?.videoUrl || newCampaign.videoUrl}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, videoUrl: e.target.value})
                  : setNewCampaign({...newCampaign, videoUrl: e.target.value})
                }
              />
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-1">
                <p className="text-[7px] text-slate-600 uppercase font-black px-1">Or Upload Video</p>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileUpload(e, 'video')}
                  className="text-[8px] text-slate-400 file:bg-cyan-500 file:border-none file:rounded-lg file:text-[8px] file:font-black file:px-2 file:py-1 cursor-pointer"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <input
                type="text"
                placeholder="THUMB URL (JPG)"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white shadow-inner"
                value={editingCampaign?.thumbnailUrl || newCampaign.thumbnailUrl}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, thumbnailUrl: e.target.value})
                  : setNewCampaign({...newCampaign, thumbnailUrl: e.target.value})
                }
              />
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-1">
                <p className="text-[7px] text-slate-600 uppercase font-black px-1">Or Upload Thumb</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'thumb')}
                  className="text-[8px] text-slate-400 file:bg-cyan-500 file:border-none file:rounded-lg file:text-[8px] file:font-black file:px-2 file:py-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <input
            type="text"
            placeholder="REQUIRED AUDIO TRACK"
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white shadow-inner"
            value={editingCampaign?.audioName || newCampaign.audioName}
            onChange={(e) => editingCampaign
              ? setEditingCampaign({...editingCampaign, audioName: e.target.value})
              : setNewCampaign({...newCampaign, audioName: e.target.value})
            }
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="Viral View Criteria"
              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white shadow-inner"
              value={editingCampaign?.goalViews || newCampaign.goalViews}
              onChange={(e) => editingCampaign
                ? setEditingCampaign({...editingCampaign, goalViews: parseInt(e.target.value)})
                : setNewCampaign({...newCampaign, goalViews: parseInt(e.target.value)})
              }
            />
            <input
              type="number"
              placeholder="Viral Like Criteria"
              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white shadow-inner"
              value={editingCampaign?.goalLikes || newCampaign.goalLikes}
              onChange={(e) => editingCampaign
                ? setEditingCampaign({...editingCampaign, goalLikes: parseInt(e.target.value)})
                : setNewCampaign({...newCampaign, goalLikes: parseInt(e.target.value)})
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="HASHTAGS (#viral #reels)"
              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white shadow-inner"
              value={editingCampaign?.hashtags || newCampaign.hashtags}
              onChange={(e) => editingCampaign
                ? setEditingCampaign({...editingCampaign, hashtags: e.target.value})
                : setNewCampaign({...newCampaign, hashtags: e.target.value})
              }
            />
            <input
              type="text"
              placeholder="BIO LINK URL"
              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white shadow-inner"
              value={editingCampaign?.bioLink || newCampaign.bioLink}
              onChange={(e) => editingCampaign
                ? setEditingCampaign({...editingCampaign, bioLink: e.target.value})
                : setNewCampaign({...newCampaign, bioLink: e.target.value})
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="Basic Reward ₹"
              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-black text-cyan-400 shadow-inner"
              value={editingCampaign?.basicPay || newCampaign.basicPay}
              onChange={(e) => editingCampaign
                ? setEditingCampaign({...editingCampaign, basicPay: parseInt(e.target.value)})
                : setNewCampaign({...newCampaign, basicPay: parseInt(e.target.value)})
              }
            />
            <input
              type="number"
              placeholder="Viral Bonus ₹"
              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-black text-cyan-400 shadow-inner"
              value={editingCampaign?.viralPay || newCampaign.viralPay}
              onChange={(e) => editingCampaign
                ? setEditingCampaign({...editingCampaign, viralPay: parseInt(e.target.value)})
                : setNewCampaign({...newCampaign, viralPay: parseInt(e.target.value)})
              }
            />
          </div>

          <textarea
            placeholder="MANDATORY DIRECTIVES"
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white h-20 resize-none shadow-inner"
            value={editingCampaign?.caption || newCampaign.caption}
            onChange={(e) => editingCampaign
              ? setEditingCampaign({...editingCampaign, caption: e.target.value})
              : setNewCampaign({...newCampaign, caption: e.target.value})
            }
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-6 rounded-[24px] font-black uppercase text-sm shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : editingCampaign ? 'Update Mission' : 'Activate Network Mission'}
          </button>
          
          {editingCampaign && (
            <button
              type="button"
              onClick={() => setEditingCampaign(null)}
              className="w-full py-3 bg-white/5 text-slate-500 rounded-2xl text-[10px] font-black uppercase border border-white/10 hover:bg-white/10 transition-colors"
            >
              Cancel Edit
            </button>
          )}
        </form>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-white italic px-2">Active Missions</h3>
        
        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <ICONS.Campaign className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-600 text-sm font-black uppercase">No campaigns created yet</p>
          </div>
        ) : (
          campaigns.map(campaign => (
            <div key={campaign.id} className="glass-panel p-4 rounded-[32px] flex justify-between items-center shadow-lg border border-white/5">
              <div className="flex items-center gap-4">
                <img 
                  src={campaign.thumbnailUrl} 
                  alt={campaign.title}
                  className="w-12 h-12 rounded-xl object-cover"
                />
                <div>
                  <p className="text-xs font-black text-white italic">{campaign.title.toUpperCase()}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-[8px] px-2 py-0.5 rounded-full ${
                      campaign.active 
                        ? 'bg-green-500/20 text-green-500' 
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {campaign.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span className="text-[8px] px-2 py-0.5 bg-cyan-500/20 text-cyan-500 rounded-full">
                      {formatCurrency(campaign.basicPay)} basic
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCampaign(campaign)}
                  className="text-[8px] font-black uppercase text-cyan-400 hover:scale-110 transition-all"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleCampaignStatus(campaign.id, campaign.active)}
                  disabled={loading}
                  className={`text-[8px] font-black uppercase transition-all ${
                    campaign.active ? 'text-orange-400' : 'text-green-400'
                  }`}
                >
                  {campaign.active ? 'Suspend' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteCampaign(campaign.id, campaign.title)}
                  disabled={loading}
                  className="text-red-600 active:scale-90 disabled:opacity-50"
                >
                  <ICONS.X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminCampaigns;
