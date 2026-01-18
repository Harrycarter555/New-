import React, { useState, useEffect } from 'react';
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
    hashtags: '#viral #trending #reels',
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
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  
  // Filter campaigns based on active tab
  const filteredCampaigns = campaigns.filter(campaign => 
    activeTab === 'active' ? campaign.active : !campaign.active
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'thumb') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB for video, 5MB for image)
    const maxSize = type === 'video' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(`File too large. Max size: ${type === 'video' ? '10MB' : '5MB'}`, 'error');
      return;
    }

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
    
    // Validation
    if (!newCampaign.title.trim()) {
      showToast('Campaign title is required', 'error');
      return;
    }
    if (!newCampaign.caption.trim()) {
      showToast('Campaign caption is required', 'error');
      return;
    }
    if (!newCampaign.audioName.trim()) {
      showToast('Audio name is required', 'error');
      return;
    }
    if (!newCampaign.videoUrl.trim() && !videoBase64) {
      showToast('Video URL or file is required', 'error');
      return;
    }
    if (!newCampaign.thumbnailUrl.trim() && !thumbBase64) {
      showToast('Thumbnail URL or file is required', 'error');
      return;
    }

    setLoading(true);
    try {
      const finalVideoUrl = videoBase64 || newCampaign.videoUrl;
      const finalThumbUrl = thumbBase64 || newCampaign.thumbnailUrl;

      await campaignService.createCampaign({
        title: newCampaign.title.trim(),
        videoUrl: finalVideoUrl,
        thumbnailUrl: finalThumbUrl,
        caption: newCampaign.caption.trim(),
        hashtags: newCampaign.hashtags.trim(),
        audioName: newCampaign.audioName.trim(),
        goalViews: newCampaign.goalViews,
        goalLikes: newCampaign.goalLikes,
        basicPay: newCampaign.basicPay,
        viralPay: newCampaign.viralPay,
        active: true,
        bioLink: newCampaign.bioLink.trim()
      }, currentUser.id);

      showToast(`🎉 Campaign "${newCampaign.title}" created successfully!`, 'success');
      
      // Reset form
      setNewCampaign({
        title: '',
        videoUrl: '',
        thumbnailUrl: '',
        caption: '',
        hashtags: '#viral #trending #reels',
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
      console.error('Create campaign error:', error);
      showToast(error.message || 'Failed to create campaign', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;

    // Validation
    if (!editingCampaign.title.trim()) {
      showToast('Campaign title is required', 'error');
      return;
    }
    if (!editingCampaign.caption.trim()) {
      showToast('Campaign caption is required', 'error');
      return;
    }
    if (!editingCampaign.audioName.trim()) {
      showToast('Audio name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      await campaignService.updateCampaign(editingCampaign.id, {
        title: editingCampaign.title.trim(),
        videoUrl: editingCampaign.videoUrl,
        thumbnailUrl: editingCampaign.thumbnailUrl,
        caption: editingCampaign.caption.trim(),
        hashtags: editingCampaign.hashtags.trim(),
        audioName: editingCampaign.audioName.trim(),
        goalViews: editingCampaign.goalViews,
        goalLikes: editingCampaign.goalLikes,
        basicPay: editingCampaign.basicPay,
        viralPay: editingCampaign.viralPay,
        bioLink: editingCampaign.bioLink.trim()
      });

      showToast(`✅ Campaign "${editingCampaign.title}" updated successfully!`, 'success');
      setEditingCampaign(null);
      setVideoBase64('');
      setThumbBase64('');
    } catch (error: any) {
      console.error('Update campaign error:', error);
      showToast(error.message || 'Failed to update campaign', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaignStatus = async (campaignId: string, currentStatus: boolean) => {
    try {
      await campaignService.toggleCampaignStatus(campaignId, currentStatus);
      showToast(
        `Campaign ${!currentStatus ? 'activated' : 'suspended'} successfully`,
        'success'
      );
    } catch (error: any) {
      showToast(error.message || 'Failed to update campaign status', 'error');
    }
  };

  const deleteCampaign = async (campaignId: string, campaignTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete campaign "${campaignTitle}"? This action cannot be undone.`)) return;
    
    setLoading(true);
    try {
      await campaignService.deleteCampaign(campaignId);
      showToast(`🗑️ Campaign "${campaignTitle}" deleted successfully`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete campaign', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleCancelEdit = () => {
    setEditingCampaign(null);
    setVideoBase64('');
    setThumbBase64('');
  };

  return (
    <div className="space-y-8">
      {/* Create/Edit Campaign Form */}
      <div className="bg-black/50 border border-slate-800 p-6 rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <ICONS.Campaign className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">
            {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
          </h3>
        </div>
        
        <form onSubmit={editingCampaign ? handleUpdateCampaign : handleCreateCampaign} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Campaign Title *
              </label>
              <input
                type="text"
                placeholder="Enter campaign title"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                value={editingCampaign?.title || newCampaign.title}
                onChange={(e) => editingCampaign 
                  ? setEditingCampaign({...editingCampaign, title: e.target.value})
                  : setNewCampaign({...newCampaign, title: e.target.value})
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Audio Track Name *
              </label>
              <input
                type="text"
                placeholder="Enter audio track name"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                value={editingCampaign?.audioName || newCampaign.audioName}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, audioName: e.target.value})
                  : setNewCampaign({...newCampaign, audioName: e.target.value})
                }
                required
              />
            </div>
          </div>

          {/* Video & Thumbnail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Video URL or File *
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter video URL (MP4)"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  value={editingCampaign?.videoUrl || newCampaign.videoUrl}
                  onChange={(e) => editingCampaign
                    ? setEditingCampaign({...editingCampaign, videoUrl: e.target.value})
                    : setNewCampaign({...newCampaign, videoUrl: e.target.value})
                  }
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Or upload video:</span>
                  <input
                    type="file"
                    accept="video/mp4,video/*"
                    onChange={(e) => handleFileUpload(e, 'video')}
                    className="text-xs text-slate-400 file:bg-cyan-500 file:border-none file:rounded-lg file:text-xs file:font-bold file:px-3 file:py-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Thumbnail URL or File *
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter thumbnail URL (JPG/PNG)"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  value={editingCampaign?.thumbnailUrl || newCampaign.thumbnailUrl}
                  onChange={(e) => editingCampaign
                    ? setEditingCampaign({...editingCampaign, thumbnailUrl: e.target.value})
                    : setNewCampaign({...newCampaign, thumbnailUrl: e.target.value})
                  }
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Or upload image:</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'thumb')}
                    className="text-xs text-slate-400 file:bg-cyan-500 file:border-none file:rounded-lg file:text-xs file:font-bold file:px-3 file:py-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Goals & Rewards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Goal Views
              </label>
              <input
                type="number"
                placeholder="Enter goal views"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                value={editingCampaign?.goalViews || newCampaign.goalViews}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, goalViews: parseInt(e.target.value) || 0})
                  : setNewCampaign({...newCampaign, goalViews: parseInt(e.target.value) || 0})
                }
                min="100"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Goal Likes
              </label>
              <input
                type="number"
                placeholder="Enter goal likes"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                value={editingCampaign?.goalLikes || newCampaign.goalLikes}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, goalLikes: parseInt(e.target.value) || 0})
                  : setNewCampaign({...newCampaign, goalLikes: parseInt(e.target.value) || 0})
                }
                min="10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Basic Reward (₹)
              </label>
              <input
                type="number"
                placeholder="Enter basic reward amount"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                value={editingCampaign?.basicPay || newCampaign.basicPay}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, basicPay: parseInt(e.target.value) || 0})
                  : setNewCampaign({...newCampaign, basicPay: parseInt(e.target.value) || 0})
                }
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Viral Bonus (₹)
              </label>
              <input
                type="number"
                placeholder="Enter viral bonus amount"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                value={editingCampaign?.viralPay || newCampaign.viralPay}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, viralPay: parseInt(e.target.value) || 0})
                  : setNewCampaign({...newCampaign, viralPay: parseInt(e.target.value) || 0})
                }
                min="0"
              />
            </div>
          </div>

          {/* Hashtags & Bio Link */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Hashtags
              </label>
              <input
                type="text"
                placeholder="Enter hashtags (comma separated)"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                value={editingCampaign?.hashtags || newCampaign.hashtags}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, hashtags: e.target.value})
                  : setNewCampaign({...newCampaign, hashtags: e.target.value})
                }
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Bio Link URL
              </label>
              <input
                type="text"
                placeholder="Enter bio link URL"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                value={editingCampaign?.bioLink || newCampaign.bioLink}
                onChange={(e) => editingCampaign
                  ? setEditingCampaign({...editingCampaign, bioLink: e.target.value})
                  : setNewCampaign({...newCampaign, bioLink: e.target.value})
                }
              />
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Campaign Caption *
            </label>
            <textarea
              placeholder="Enter campaign caption/description"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white h-32 resize-none focus:outline-none focus:border-cyan-500"
              value={editingCampaign?.caption || newCampaign.caption}
              onChange={(e) => editingCampaign
                ? setEditingCampaign({...editingCampaign, caption: e.target.value})
                : setNewCampaign({...newCampaign, caption: e.target.value})
              }
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Processing...
                </>
              ) : editingCampaign ? (
                'Update Campaign'
              ) : (
                'Create Campaign'
              )}
            </button>
            
            {editingCampaign && (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={loading}
                className="px-6 bg-slate-800 text-slate-400 font-bold py-3 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Campaigns List */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Campaigns</h3>
          <div className="flex bg-slate-900/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'active' 
                  ? 'bg-cyan-500 text-black' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Active ({campaigns.filter(c => c.active).length})
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'inactive' 
                  ? 'bg-cyan-500 text-black' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Inactive ({campaigns.filter(c => !c.active).length})
            </button>
          </div>
        </div>
        
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12 bg-black/30 rounded-xl border border-slate-800">
            <ICONS.Campaign className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-bold">
              No {activeTab} campaigns found
            </p>
            {activeTab === 'inactive' && (
              <p className="text-slate-600 text-xs mt-2">
                All campaigns are currently active
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.map(campaign => (
              <div key={campaign.id} className="bg-black/30 border border-slate-800 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-colors">
                {/* Campaign Header */}
                <div className="p-4 border-b border-slate-800">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-base font-bold text-white truncate">
                      {campaign.title}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      campaign.active 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {campaign.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  {/* Campaign Preview */}
                  <div className="relative rounded-lg overflow-hidden mb-3">
                    <img 
                      src={campaign.thumbnailUrl} 
                      alt={campaign.title}
                      className="w-full h-40 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/400x200?text=No+Thumbnail';
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-xs text-white font-bold">
                        Audio: {campaign.audioName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Campaign Stats */}
                <div className="p-4 border-b border-slate-800">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Goal Views</p>
                      <p className="text-sm font-bold text-white">
                        {formatNumber(campaign.goalViews)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Goal Likes</p>
                      <p className="text-sm font-bold text-white">
                        {formatNumber(campaign.goalLikes)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Basic Reward</p>
                      <p className="text-sm font-bold text-cyan-400">
                        {formatCurrency(campaign.basicPay)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Viral Bonus</p>
                      <p className="text-sm font-bold text-green-400">
                        {formatCurrency(campaign.viralPay)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 flex gap-2">
                  <button
                    onClick={() => setEditingCampaign(campaign)}
                    className="flex-1 bg-cyan-500/10 text-cyan-400 text-sm font-bold py-2 rounded-lg hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <ICONS.Edit className="w-4 h-4" />
                    Edit
                  </button>
                  
                  <button
                    onClick={() => toggleCampaignStatus(campaign.id, campaign.active)}
                    className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      campaign.active
                        ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    <ICONS.Power className="w-4 h-4" />
                    {campaign.active ? 'Suspend' : 'Activate'}
                  </button>
                  
                  <button
                    onClick={() => deleteCampaign(campaign.id, campaign.title)}
                    className="px-3 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors flex items-center justify-center"
                    title="Delete campaign"
                  >
                    <ICONS.Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Campaigns</p>
              <p className="text-2xl font-bold text-white">{campaigns.length}</p>
            </div>
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <ICONS.Campaign className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active Campaigns</p>
              <p className="text-2xl font-bold text-green-400">
                {campaigns.filter(c => c.active).length}
              </p>
            </div>
            <div className="p-2 bg-green-500/20 rounded-lg">
              <ICONS.Active className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Reward Pool</p>
              <p className="text-2xl font-bold text-amber-400">
                {formatCurrency(campaigns.reduce((sum, c) => sum + c.basicPay + c.viralPay, 0))}
              </p>
            </div>
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <ICONS.Coins className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Avg. Reward</p>
              <p className="text-2xl font-bold text-purple-400">
                {campaigns.length > 0 
                  ? formatCurrency(Math.round(campaigns.reduce((sum, c) => sum + c.basicPay, 0) / campaigns.length))
                  : '₹0'
                }
              </p>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ICONS.Dollar className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCampaigns;
