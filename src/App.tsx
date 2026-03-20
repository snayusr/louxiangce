import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  MapPin, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Video, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  LayoutGrid, 
  Settings,
  Navigation,
  ArrowLeft,
  X,
  Lock,
  Edit2,
  ExternalLink,
  MessageCircle,
  MessageSquare,
  Globe,
  Save,
  Send,
  Megaphone,
  Link as LinkIcon,
  Heart,
  Users,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill from 'react-quill-new';
import { Category, AlbumEntry, Location } from './types';

// Register custom video blot for Quill to support local video files
const Quill = (ReactQuill as any).Quill;
const BlockEmbed = Quill.import('blots/block/embed');

class VideoBlot extends (BlockEmbed as any) {
  static create(value: string) {
    const node = super.create();
    node.setAttribute('src', value);
    node.setAttribute('controls', 'true');
    node.setAttribute('controlsList', 'nodownload');
    node.setAttribute('width', '100%');
    node.className = 'ql-video-custom';
    return node;
  }

  static value(node: HTMLElement) {
    return node.getAttribute('src');
  }
}
(VideoBlot as any).blotName = 'video';
(VideoBlot as any).tagName = 'video';
Quill.register(VideoBlot);

// --- Utils ---
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return parseFloat((R * c).toFixed(2));
};

// --- Components ---

const LandingPage = ({ onUnlock, siteName }: { onUnlock: (pass: string) => Promise<boolean>, siteName: string }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError('');
    const success = await onUnlock(password);
    if (!success) {
      setError('密码错误，请重试');
    }
    setIsVerifying(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-pink-light">
      {/* Rotating Background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <div className="w-[150vw] h-[150vw] md:w-[80vw] md:h-[80vw] rounded-full border-[40px] border-pink-dark/30 animate-rotate-slow border-dashed" />
        <div className="absolute w-[120vw] h-[120vw] md:w-[60vw] md:h-[60vw] rounded-full border-[20px] border-pink-primary/20 animate-rotate-slow [animation-direction:reverse] border-dotted" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-8 rounded-[2rem] w-full max-w-md mx-4 text-center relative z-10 shadow-2xl"
      >
        <div className="w-20 h-20 pink-gradient rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-lg animate-bounce">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-serif font-bold text-pink-dark mb-2">{siteName || 'Pink Moments'}</h1>
        <p className="text-slate-500 mb-8">这是一片私密的回忆领地，请输入访问密码</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入访问密码"
              className="w-full px-6 py-4 rounded-2xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-dark transition-all text-center text-lg tracking-[0.5em]"
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          <button 
            type="submit"
            disabled={isVerifying}
            className="w-full pink-gradient text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-pink-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isVerifying ? '验证中...' : '开启回忆之旅'}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-pink-50 text-[10px] text-slate-400 uppercase tracking-widest">
          Private Gallery &copy; {new Date().getFullYear()}
        </div>
      </motion.div>
    </div>
  );
};

const Navbar = ({ onAdminToggle, isAdmin, isLoggedIn, siteName, siteLogo }: { onAdminToggle: () => void, isAdmin: boolean, isLoggedIn: boolean, siteName: string, siteLogo: string }) => (
  <nav className="fixed top-0 left-0 right-0 z-50 glass-card h-16">
    <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {siteLogo ? (
          <img src={siteLogo} alt="Logo" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 pink-gradient rounded-full flex items-center justify-center text-white">
            <Camera size={20} />
          </div>
        )}
        <h1 className="text-xl font-serif font-bold tracking-tight text-pink-dark">{siteName}</h1>
      </div>
      <button 
        onClick={onAdminToggle}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-pink-light text-pink-dark hover:bg-pink-primary hover:text-white transition-all font-medium text-sm"
      >
        {isAdmin ? <ArrowLeft size={16} /> : (isLoggedIn ? <Settings size={16} /> : <Lock size={16} />)}
        {isAdmin ? '返回相册' : (isLoggedIn ? '' : '')}
      </button>
    </div>
  </nav>
);

const MapModal = ({ album, onClose }: { album: AlbumEntry, onClose: () => void }) => {
  if (!album.lat || !album.lng) return null;

  const handleOpenApp = (appName: string, scheme: string) => {
    const start = Date.now();
    const a = document.createElement('a');
    a.href = scheme;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const handleBlur = () => {
      clearTimeout(timeout);
      window.removeEventListener('blur', handleBlur);
    };
    window.addEventListener('blur', handleBlur, { once: true });

    const timeout = setTimeout(() => {
      window.removeEventListener('blur', handleBlur);
      if (Date.now() - start < 3000) {
        alert(`您手机未安装${appName}，请安装后重试`);
      }
    }, 2500);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const maps = [
    {
      name: '高德地图',
      // 使用 OS 特定的协议头，这是最标准的方式
      scheme: isIOS 
        ? `iosamap://viewMap?sourceApplication=pinkmoments&poiname=${encodeURIComponent(album.location_name || album.title)}&lat=${album.lat}&lon=${album.lng}&dev=0`
        : `androidamap://viewMap?sourceApplication=pinkmoments&poiname=${encodeURIComponent(album.location_name || album.title)}&lat=${album.lat}&lon=${album.lng}&dev=0`
    },
    {
      name: '百度地图',
      // 百度地图使用统一协议，但增加更多参数提高兼容性
      scheme: `baidumap://map/marker?location=${album.lat},${album.lng}&title=${encodeURIComponent(album.title)}&content=${encodeURIComponent(album.location_name || '')}&coord_type=gcj02&src=pinkmoments`
    },
    {
      name: '腾讯地图',
      // 腾讯地图使用统一协议
      scheme: `qqmap://map/marker?marker=coord:${album.lat},${album.lng};title:${encodeURIComponent(album.title)};addr:${encodeURIComponent(album.location_name || '')}&referer=pinkmoments`
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="pink-gradient p-6 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">{album.location_name || '地点详情'}</h3>
            <p className="text-xs opacity-80 mt-1">坐标: {album.lat.toFixed(4)}, {album.lng.toFixed(4)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-slate-500 text-sm mb-4">唤起手机本地应用进行导航：</p>
          {maps.map(map => (
            <button 
              key={map.name}
              onClick={() => handleOpenApp(map.name, map.scheme)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-pink-50 hover:text-pink-dark transition-all group text-left"
            >
              <span className="font-medium">{map.name}</span>
              <Navigation size={18} className="text-slate-300 group-hover:text-pink-dark" />
            </button>
          ))}
          <p className="text-[10px] text-slate-400 text-center mt-4">
            * 导航功能需手机已安装对应地图应用
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const MediaUploader = ({ onUpload, isUploading, setIsUploading }: { onUpload: (items: {url: string, type: 'image' | 'video'}[]) => void, isUploading?: boolean, setIsUploading?: (val: boolean) => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (setIsUploading) setIsUploading(true);
    const newItems: {url: string, type: 'image' | 'video'}[] = [];
    
    try {
      for (const file of Array.from(files) as File[]) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            const type = file.type.startsWith('video') ? 'video' : 'image';
            newItems.push({ url: data.url, type });
          } else {
            const errData = await res.json();
            alert(`文件 ${file.name} 上传失败: ${errData.error || res.statusText}`);
          }
        } catch (err) {
          console.error("Upload failed:", err);
          alert(`文件 ${file.name} 上传失败，请检查网络连接`);
        }
      }
      
      if (newItems.length > 0) {
        onUpload(newItems);
      }
    } finally {
      if (setIsUploading) setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div 
      onClick={() => !isUploading && fileInputRef.current?.click()}
      className={`border-2 border-dashed border-pink-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-pink-50'}`}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,video/*"
        multiple
        disabled={isUploading}
      />
      <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-pink-dark">
        {isUploading ? <div className="w-6 h-6 border-2 border-pink-dark border-t-transparent rounded-full animate-spin" /> : <Plus size={24} />}
      </div>
      <p className="text-pink-dark font-medium">{isUploading ? '正在上传中...' : '点击上传多张照片或视频'}</p>
      <p className="text-xs text-pink-300">支持批量上传 JPG, PNG, MP4</p>
    </div>
  );
};

const ArticlePage = ({ album, onBack, onMapOpen, onCategoryClick }: { album: AlbumEntry, onBack: () => void, onMapOpen: (a: AlbumEntry) => void, onCategoryClick: (id: number) => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="max-w-4xl mx-auto pb-20"
    >
      <div className="relative flex items-center justify-between mb-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-pink-dark hover:translate-x-1 transition-transform z-10"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">返回相册</span>
        </button>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button 
            onClick={() => onCategoryClick(album.category_id)}
            className="px-4 py-1.5 bg-pink-light/50 text-pink-dark text-xs font-bold rounded-full uppercase tracking-widest backdrop-blur-sm hover:bg-pink-primary hover:text-white transition-all cursor-pointer pointer-events-auto"
          >
            {album.category_name}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden">
        {/* Top Section: Text Content */}
        <div className="p-4 md:p-8">
          <div 
            className="prose prose-pink prose-lg max-w-none text-slate-600 leading-relaxed mb-12"
            dangerouslySetInnerHTML={{ __html: album.description }}
          />

          <div className="flex items-center justify-between py-6 border-t border-pink-50">
            <button 
              onClick={() => onMapOpen(album)}
              className="flex items-center gap-2 text-pink-dark hover:text-pink-primary transition-colors group"
            >
              <div className="w-10 h-10 bg-pink-50 rounded-full flex items-center justify-center group-hover:bg-pink-100 transition-colors">
                <MapPin size={20} />
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-400 font-medium">记录地点·点这里可直接导航！</p>
                <p className="font-bold underline decoration-pink-200 underline-offset-4">{album.location_name || '未知地点'}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Section: Media Gallery */}
        <div className="bg-slate-50/50 p-4 md:p-8 space-y-6">
          <div className="flex items-center justify-between px-4">
            <span className="text-slate-400 text-sm font-mono">
              {new Date(album.created_at).toLocaleDateString()} {new Date(album.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {album.media.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="rounded-3xl overflow-hidden shadow-sm bg-white"
              >
                {item.type === 'image' ? (
                  <img src={item.url} className="w-full h-auto" alt={`moment-${idx}`} />
                ) : (
                  <video src={item.url} className="w-full h-auto" controls />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [albums, setAlbums] = useState<AlbumEntry[]>([]);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'ip' | 'none'>('none');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [activeMapAlbum, setActiveMapAlbum] = useState<AlbumEntry | null>(null);
  const [activeAlbum, setActiveAlbum] = useState<AlbumEntry | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  
  const [settings, setSettings] = useState({ site_name: 'Pink Moments', customer_service_url: '', announcement: '', site_logo: '', site_password: '' });
  const [tempSettings, setTempSettings] = useState({ site_name: '', customer_service_url: '', announcement: '', site_logo: '', site_password: '' });
  const [changePasswordForm, setChangePasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [stats, setStats] = useState({ daysRunning: 0, totalVisitors: 0, onlineUsers: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSiteUnlocked, setIsSiteUnlocked] = useState(() => localStorage.getItem('siteUnlocked') === 'true');
  const [isLocating, setIsLocating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Silent IP-based Geolocation with Fallback (Improved for Mobile)
  const fetchIPLocation = async () => {
    if (isLocating || locationSource === 'gps') return;
    setIsLocating(true);
    
    const providers = [
      'https://ipwho.is/',
      'https://freeipapi.com/api/json',
      'https://ip.useragentinfo.com/json',
      'https://ipapi.co/json/',
      'https://ip.nf/me.json'
    ];

    for (const url of providers) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        
        const lat = data.latitude || data.lat || (data.ip?.latitude);
        const lng = data.longitude || data.lon || (data.ip?.longitude);
        
        if (lat && lng) {
          setUserLocation({ lat: Number(lat), lng: Number(lng) });
          setLocationSource('ip');
          setIsLocating(false);
          return;
        }
      } catch (err) {
        continue;
      }
    }
    setIsLocating(false);
  };

  const fetchGPSLocation = () => {
    if (!navigator.geolocation) {
      fetchIPLocation();
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationSource('gps');
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (locationSource !== 'gps') {
          fetchIPLocation();
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const title = settings.site_name || 'Pink Moments';
    document.title = title;
    console.log(`[App] Title updated to: ${title}`);
  }, [settings.site_name]);

  // Form State
  const [newAlbum, setNewAlbum] = useState<Partial<AlbumEntry>>({
    title: '',
    description: '',
    category_id: 1,
    media: [],
    lat: null,
    lng: null,
    location_name: ''
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    fetchData();
    
    // Initial GPS fetch
    fetchGPSLocation();

    // Set up continuous tracking
    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationSource('gps');
        },
        (err) => console.warn("[Location] Watch failed:", err.message),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
      );
    }

    // Check local storage for login status (simplified)
    const savedLogin = localStorage.getItem('isLoggedIn');
    if (savedLogin === 'true') {
      setIsLoggedIn(true);
      setIsSiteUnlocked(true);
    }

    const interval = setInterval(() => {
      if (!activeAlbum && !isAdmin) {
        fetch('/api/stats')
          .then(res => res.json())
          .then(data => setStats(data))
          .catch(err => console.error("Stats refresh error:", err));
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeAlbum, isAdmin]);

  const fetchData = async () => {
    const [catsRes, albumsRes, settingsRes, statsRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/albums'),
      fetch('/api/settings'),
      fetch('/api/stats')
    ]);
    const cats = await catsRes.json();
    const albums = await albumsRes.json();
    const settingsData = await settingsRes.json();
    const statsData = await statsRes.json();
    
    setCategories(cats);
    setAlbums(albums);
    setSettings(settingsData);
    setTempSettings(settingsData);
    setStats(statsData);
    
    // Data is ready, turn off loading screen
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleUpdateSettings = async () => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tempSettings)
    });
    if (res.ok) {
      setSettings(tempSettings);
      alert('设置已保存');
    }
  };

  const handleVerifySitePassword = async (password: string) => {
    try {
      const res = await fetch('/api/verify-site-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setIsSiteUnlocked(true);
        localStorage.setItem('siteUnlocked', 'true');
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      alert("两次输入的新密码不一致");
      return;
    }
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldPassword: changePasswordForm.oldPassword,
        newPassword: changePasswordForm.newPassword
      })
    });
    if (res.ok) {
      alert("密码修改成功！请重新登录。");
      handleLogout();
      setChangePasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } else {
      const err = await res.json();
      alert(err.error || "修改失败");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm)
    });
    if (res.ok) {
      setIsLoggedIn(true);
      setShowLogin(false);
      setIsAdmin(true);
      setIsSiteUnlocked(true);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('siteUnlocked', 'true');
    } else {
      alert("登录失败，请检查用户名和密码");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    localStorage.removeItem('isLoggedIn');
  };

  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName, parent_id: newCategoryParentId })
    });
    alert("分类添加成功！");
    setNewCategoryName('');
    setNewCategoryParentId(null);
    fetchData();
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    await fetch(`/api/categories/${editingCategory.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingCategory.name, parent_id: editingCategory.parent_id })
    });
    alert("分类修改成功！");
    setEditingCategory(null);
    fetchData();
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("确定删除该分类吗？如果该分类下有相册将无法删除。")) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert("分类删除成功！");
    } else {
      const err = await res.json();
      alert(err.error);
    }
    fetchData();
  };

  const handleAddAlbum = async () => {
    if (!newAlbum.title || !newAlbum.media || newAlbum.media.length === 0) {
      alert("请填写标题并上传媒体");
      return;
    }

    const url = editingAlbumId ? `/api/albums/${editingAlbumId}` : '/api/albums';
    const method = editingAlbumId ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAlbum)
    });

    alert(editingAlbumId ? "修改成功！" : "发布成功！");

    setNewAlbum({
      title: '',
      description: '',
      category_id: categories[0]?.id || 1,
      media: [],
      lat: null,
      lng: null,
      location_name: ''
    });
    setEditingAlbumId(null);
    fetchData();
    setIsAdmin(false);
  };

  const handleEditAlbum = (album: AlbumEntry) => {
    // Log for debugging (visible in browser console)
    console.log("Editing Album Data:", album);
    
    // Set both the ID and the data in a way that minimizes re-renders
    setEditingAlbumId(album.id);
    setNewAlbum({
      title: album.title || '',
      description: album.description || '',
      category_id: album.category_id || (categories[0]?.id || 1),
      media: Array.isArray(album.media) ? [...album.media] : [],
      lat: album.lat,
      lng: album.lng,
      location_name: album.location_name || ''
    });
    
    // Smooth scroll to the top where the form is located
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAlbum = async (id: number) => {
    if (!confirm("确定删除吗？")) return;
    const res = await fetch(`/api/albums/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert("相册删除成功！");
    } else {
      const err = await res.json();
      alert(err.error);
    }
    fetchData();
  };

  const handleReorder = async (album: AlbumEntry, direction: 'up' | 'down') => {
    const currentIndex = albums.findIndex(a => a.id === album.id);
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === albums.length - 1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetAlbum = albums[targetIndex];

    // If both have the same sort_order (e.g. 0), we need to assign them unique ones first
    let order1 = targetAlbum.sort_order;
    let order2 = album.sort_order;

    if (order1 === order2) {
      // If they are equal, we force a difference based on the direction
      // Since the list is ORDER BY sort_order DESC, the one "above" should have a higher sort_order
      if (direction === 'up') {
        order1 = album.sort_order + 1;
        order2 = album.sort_order;
      } else {
        order1 = album.sort_order - 1;
        order2 = album.sort_order;
      }
    }

    const res = await fetch('/api/albums/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id1: album.id,
        order1: order1,
        id2: targetAlbum.id,
        order2: order2
      })
    });

    if (res.ok) {
      fetchData();
    }
  };

  const filteredAlbums = selectedCategory === 'all' 
    ? albums 
    : albums.filter(a => {
        if (a.category_id === selectedCategory) return true;
        const subCatIds = categories.filter(c => c.parent_id === selectedCategory).map(c => c.id);
        return subCatIds.includes(a.category_id);
      });

  const quillModules = React.useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['image', 'video', 'clean']
      ],
      handlers: {
        image: function() {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();
          input.onchange = async () => {
            const file = input.files?.[0];
            if (file) {
              setIsUploading(true);
              const formData = new FormData();
              formData.append('file', file);
              try {
                const res = await fetch('/api/upload', {
                  method: 'POST',
                  body: formData
                });
                if (res.ok) {
                  const data = await res.json();
                  // @ts-ignore
                  const quill = this.quill;
                  const range = quill.getSelection();
                  quill.insertEmbed(range.index, 'image', data.url);
                } else {
                  const errData = await res.json();
                  alert(`图片上传失败: ${errData.error || res.statusText}`);
                }
              } catch (err) {
                console.error("Upload failed:", err);
                alert("图片上传失败，请检查网络连接");
              } finally {
                setIsUploading(false);
              }
            }
          };
        },
        video: function() {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'video/*');
          input.click();
          input.onchange = async () => {
            const file = input.files?.[0];
            if (file) {
              setIsUploading(true);
              const formData = new FormData();
              formData.append('file', file);
              try {
                const res = await fetch('/api/upload', {
                  method: 'POST',
                  body: formData
                });
                if (res.ok) {
                  const data = await res.json();
                  // @ts-ignore
                  const quill = this.quill;
                  const range = quill.getSelection();
                  // Quill's default video embed uses iframe, which works for direct video links too
                  quill.insertEmbed(range.index, 'video', data.url);
                } else {
                  const errData = await res.json();
                  alert(`视频上传失败: ${errData.error || res.statusText}`);
                }
              } catch (err) {
                console.error("Upload failed:", err);
                alert("视频上传失败，请检查网络连接");
              } finally {
                setIsUploading(false);
              }
            }
          };
        }
      }
    }
  }), [setIsUploading]);

  return (
    <div className="min-h-screen pb-20">
      {/* Global Uploading Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-sm"
          >
            <div className="glass-card p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl">
              <div className="w-12 h-12 border-4 border-pink-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-pink-dark font-bold text-lg">正在上传媒体文件...</p>
                <p className="text-slate-400 text-sm">请稍候，这可能需要一点时间</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isSiteUnlocked && (
          <LandingPage 
            siteName={settings.site_name} 
            onUnlock={handleVerifySitePassword} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoading && (
          <motion.div 
            key="loader"
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center"
          >
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-20 h-20 pink-gradient rounded-full flex items-center justify-center text-white shadow-xl mb-6"
            >
              <Camera size={40} />
            </motion.div>
            <h2 className="text-2xl font-serif font-bold text-pink-dark animate-pulse">{settings.site_name}</h2>
            <div className="mt-8 flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div 
                  key={i}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  className="w-2 h-2 bg-pink-primary rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar 
        isAdmin={isAdmin} 
        isLoggedIn={isLoggedIn}
        siteName={settings.site_name}
        siteLogo={settings.site_logo}
        onAdminToggle={() => {
          if (isLoggedIn) {
            setIsAdmin(!isAdmin);
            setActiveAlbum(null);
            setEditingAlbumId(null);
            setNewAlbum({
              title: '',
              description: '',
              category_id: categories[0]?.id || 1,
              media: [],
              lat: null,
              lng: null,
              location_name: ''
            });
          } else {
            setShowLogin(true);
          }
        }} 
      />
      
      <main className="pt-24 px-4 max-w-7xl mx-auto">
        {!isAdmin ? (
          <AnimatePresence mode="wait">
            {activeAlbum ? (
              <div key="article">
                <ArticlePage 
                  album={activeAlbum} 
                  onBack={() => setActiveAlbum(null)} 
                  onMapOpen={(a) => setActiveMapAlbum(a)}
                  onCategoryClick={(id) => {
                    setSelectedCategory(id);
                    setActiveAlbum(null);
                  }}
                />
              </div>
            ) : (
              <motion.div 
                key="gallery"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Album Grid */}
                <div className="mb-10">
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4">
                    <button 
                      onClick={() => setSelectedCategory('all')}
                      className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all font-bold text-sm ${selectedCategory === 'all' ? 'pink-gradient text-white shadow-lg shadow-pink-200' : 'bg-white text-slate-500 hover:bg-pink-50'}`}
                    >
                      全部
                    </button>
                    {categories.filter(c => !c.parent_id).map(cat => {
                      const hasChildren = categories.some(c => c.parent_id === cat.id);
                      const isActive = selectedCategory === cat.id || categories.find(c => c.id === selectedCategory)?.parent_id === cat.id;
                      
                      return (
                        <button 
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all font-bold text-sm flex items-center gap-2 ${
                            isActive 
                              ? 'pink-gradient text-white shadow-lg shadow-pink-200' 
                              : 'bg-white text-slate-500 hover:bg-pink-50'
                          }`}
                        >
                          {cat.name}
                          {hasChildren && (
                            <ChevronDown 
                              size={14} 
                              className={`transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} 
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Subcategories Dropdown Area */}
                  <AnimatePresence>
                    {typeof selectedCategory === 'number' && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-wrap gap-2 p-4 bg-pink-50/50 rounded-[2rem] border border-pink-100/50 mt-2">
                          {/* "All" option for the current parent category */}
                          {(() => {
                            const currentCat = categories.find(c => c.id === selectedCategory);
                            const parentId = currentCat?.parent_id || selectedCategory;
                            const parent = categories.find(c => c.id === parentId);
                            
                            return (
                              <button 
                                onClick={() => setSelectedCategory(parentId)}
                                className={`px-4 py-1.5 rounded-xl whitespace-nowrap transition-all text-xs font-bold ${
                                  selectedCategory === parentId 
                                    ? 'bg-pink-dark text-white' 
                                    : 'bg-white/50 text-pink-dark/60 hover:bg-white'
                                }`}
                              >
                                全部{parent?.name}
                              </button>
                            );
                          })()}

                          {/* Actual subcategories */}
                          {categories
                            .filter(c => {
                              const currentCat = categories.find(curr => curr.id === selectedCategory);
                              const activeParentId = currentCat?.parent_id || selectedCategory;
                              return c.parent_id === activeParentId;
                            })
                            .map(sub => (
                              <button 
                                key={sub.id}
                                onClick={() => setSelectedCategory(sub.id)}
                                className={`px-4 py-1.5 rounded-xl whitespace-nowrap transition-all text-xs font-bold ${
                                  selectedCategory === sub.id 
                                    ? 'bg-pink-dark text-white shadow-sm' 
                                    : 'bg-white/50 text-pink-dark/60 hover:bg-white'
                                }`}
                              >
                                {sub.name}
                              </button>
                            ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Album Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <AnimatePresence mode="popLayout">
                    {filteredAlbums.map((album) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={album.id}
                        onClick={() => setActiveAlbum(album)}
                        className="glass-card rounded-3xl overflow-hidden group hover:shadow-xl transition-all duration-500 cursor-pointer"
                      >
                        <div className="relative aspect-[4/5] overflow-hidden">
                          {album.media[0]?.type === 'image' ? (
                            <img 
                              src={album.media[0].url} 
                              alt={album.title} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                          ) : (
                            <video 
                              src={album.media[0]?.url} 
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute top-4 left-4">
                            <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-pink-dark text-xs font-bold rounded-full uppercase tracking-wider">
                              {album.category_name}
                            </span>
                          </div>
                          {album.media.length > 1 && (
                            <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/40 backdrop-blur-sm text-white text-[10px] rounded-lg">
                              +{album.media.length - 1} 张
                            </div>
                          )}
                        </div>
                        
                        <div className="p-6">
                          <h3 className="text-2xl font-serif font-bold text-slate-800 mb-2">{album.title}</h3>
                          <div 
                            className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-2 prose prose-pink prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: album.description }}
                          />
                          
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-pink-50">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                album.lat !== null && album.lng !== null && setActiveMapAlbum(album);
                              }}
                              className="flex items-center gap-2 text-pink-dark hover:text-pink-primary transition-colors"
                            >
                              <MapPin size={16} />
                              <span className="text-xs font-medium underline decoration-pink-200 underline-offset-4">
                                {album.location_name || '未知地点'}
                              </span>
                            </button>
                            
                            {userLocation && !isNaN(Number(userLocation.lat)) && album.lat !== null && album.lng !== null && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <Navigation size={14} />
                                <span className="text-xs font-mono">
                                  {(() => {
                                    const dist = calculateDistance(
                                      Number(userLocation.lat), 
                                      Number(userLocation.lng), 
                                      Number(album.lat), 
                                      Number(album.lng)
                                    );
                                    if (isNaN(dist)) return '计算中...';
                                    if (dist < 1) return `${(dist * 1000).toFixed(0)} m`;
                                    return `${dist} km`;
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Site Statistics (Only on Homepage) */}
                {!activeAlbum && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-32 mb-16 px-4"
                  >
                    <div className="max-w-3xl mx-auto">
                      <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                        {/* Days Running - Circle */}
                        <motion.div 
                          whileHover={{ scale: 1.05 }}
                          className="relative w-32 h-32 md:w-40 md:h-40 flex flex-col items-center justify-center"
                        >
                          <div className="absolute inset-0 bg-pink-50 rounded-full shadow-inner border border-pink-100/50 animate-pulse-slow"></div>
                          <div className="relative z-10 flex flex-col items-center">
                            <Heart className="text-pink-primary mb-1 fill-pink-primary/10" size={20} />
                            <span className="text-2xl md:text-3xl font-serif font-bold text-pink-dark leading-none">{stats.daysRunning}</span>
                            <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">已运行天数</span>
                          </div>
                        </motion.div>

                        {/* Total Visitors - Heart Shape (SVG) */}
                        <motion.div 
                          whileHover={{ scale: 1.05 }}
                          className="relative w-36 h-36 md:w-48 md:h-48 flex flex-col items-center justify-center"
                        >
                          <svg className="absolute inset-0 w-full h-full text-pink-100 drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          <div className="relative z-10 flex flex-col items-center">
                            <Users className="text-pink-dark mb-1" size={24} />
                            <span className="text-3xl md:text-4xl font-serif font-bold text-pink-dark leading-none">{stats.totalVisitors}</span>
                            <span className="text-[10px] md:text-[11px] text-pink-dark/60 font-bold uppercase tracking-widest mt-1">累积访客</span>
                          </div>
                        </motion.div>

                        {/* Online Users - Circle */}
                        <motion.div 
                          whileHover={{ scale: 1.05 }}
                          className="relative w-32 h-32 md:w-40 md:h-40 flex flex-col items-center justify-center"
                        >
                          <div className="absolute inset-0 bg-pink-50 rounded-full shadow-inner border border-pink-100/50 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
                          <div className="relative z-10 flex flex-col items-center">
                            <Activity className="text-emerald-400 mb-1" size={20} />
                            <span className="text-2xl md:text-3xl font-serif font-bold text-pink-dark leading-none">{stats.onlineUsers}</span>
                            <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">当前在线</span>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-serif font-bold text-pink-dark">管理后台</h2>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-slate-400 hover:text-red-500 transition-colors"
              >
                退出登录
              </button>
            </div>

            {/* Site Settings */}
            <div className="glass-card rounded-3xl p-8 mb-8">
              <h3 className="text-xl font-serif font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Settings size={20} className="text-pink-dark" />
                网站设置
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">网站名称</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300" size={18} />
                      <input 
                        type="text" 
                        value={tempSettings.site_name}
                        onChange={e => setTempSettings({...tempSettings, site_name: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                        placeholder="网站名称"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Telegram 客服链接</label>
                    <div className="relative">
                      <Send className="absolute left-4 top-1/2 -translate-y-1/2 text-[#24A1DE]" size={18} />
                      <input 
                        type="text" 
                        value={tempSettings.customer_service_url}
                        onChange={e => setTempSettings({...tempSettings, customer_service_url: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                        placeholder="https://t.me/your_username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">滚动公告内容</label>
                    <div className="relative">
                      <Megaphone className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300" size={18} />
                      <input 
                        type="text" 
                        value={tempSettings.announcement}
                        onChange={e => setTempSettings({...tempSettings, announcement: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                        placeholder="显示在底部的走字广告内容..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">网站 Logo (URL)</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300" size={18} />
                      <input 
                        type="text" 
                        value={tempSettings.site_logo}
                        onChange={e => setTempSettings({...tempSettings, site_logo: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                        placeholder="https://.../logo.png"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">网站访问密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300" size={18} />
                      <input 
                        type="text" 
                        value={tempSettings.site_password}
                        onChange={e => setTempSettings({...tempSettings, site_password: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                        placeholder="默认: 123456"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleUpdateSettings}
                    className="w-full py-3 pink-gradient text-white rounded-xl font-bold shadow-lg hover:shadow-pink-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    保存设置
                  </button>
                </div>
                <div className="bg-pink-50/50 rounded-2xl p-6 flex flex-col justify-center text-center">
                  <p className="text-pink-dark/60 text-sm mb-4">
                    在这里您可以修改网站的名称以及右下角悬浮客服的跳转链接。
                  </p>
                  <button 
                    onClick={() => setShowPasswordSection(!showPasswordSection)}
                    className="py-2 px-4 bg-white border border-pink-200 text-pink-dark rounded-xl text-xs font-bold hover:bg-pink-primary hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 mx-auto"
                  >
                    <Lock size={14} />
                    {showPasswordSection ? '取消修改密码' : '修改后台密码'}
                  </button>

                  <AnimatePresence>
                    {showPasswordSection && (
                      <motion.form 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleChangePassword}
                        className="mt-6 space-y-4 overflow-hidden"
                      >
                        <input 
                          type="password" 
                          required
                          placeholder="当前密码"
                          value={changePasswordForm.oldPassword}
                          onChange={e => setChangePasswordForm({...changePasswordForm, oldPassword: e.target.value})}
                          className="w-full px-4 py-2 rounded-xl border border-pink-100 text-sm focus:ring-2 focus:ring-pink-200 outline-none"
                        />
                        <input 
                          type="password" 
                          required
                          placeholder="新密码"
                          value={changePasswordForm.newPassword}
                          onChange={e => setChangePasswordForm({...changePasswordForm, newPassword: e.target.value})}
                          className="w-full px-4 py-2 rounded-xl border border-pink-100 text-sm focus:ring-2 focus:ring-pink-200 outline-none"
                        />
                        <input 
                          type="password" 
                          required
                          placeholder="确认新密码"
                          value={changePasswordForm.confirmPassword}
                          onChange={e => setChangePasswordForm({...changePasswordForm, confirmPassword: e.target.value})}
                          className="w-full px-4 py-2 rounded-xl border border-pink-100 text-sm focus:ring-2 focus:ring-pink-200 outline-none"
                        />
                        <button 
                          type="submit"
                          className="w-full py-2 pink-gradient text-white rounded-xl text-sm font-bold shadow-md"
                        >
                          确认修改
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Category Management */}
            <div className="glass-card rounded-3xl p-8 mb-8">
              <h3 className="text-xl font-serif font-bold text-slate-800 mb-6 flex items-center gap-2">
                <LayoutGrid size={20} className="text-pink-dark" />
                分类管理
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        className="flex-1 px-4 py-2 rounded-xl border border-pink-100 focus:ring-2 focus:ring-pink-200 outline-none"
                        placeholder="新分类名称"
                      />
                      <button 
                        onClick={handleAddCategory}
                        className="p-2 pink-gradient text-white rounded-xl"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <select 
                      value={newCategoryParentId || ''}
                      onChange={e => setNewCategoryParentId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-4 py-2 rounded-xl border border-pink-100 focus:ring-2 focus:ring-pink-200 outline-none text-sm text-slate-500"
                    >
                      <option value="">作为一级分类</option>
                      {categories.filter(c => !c.parent_id).map(c => (
                        <option key={c.id} value={c.id}>隶属于: {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {categories.filter(c => !c.parent_id).map(parent => (
                      <div key={parent.id} className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-pink-100 rounded-xl">
                          {editingCategory?.id === parent.id ? (
                            <input 
                              autoFocus
                              value={editingCategory.name}
                              onChange={e => setEditingCategory({...editingCategory, name: e.target.value})}
                              onBlur={handleUpdateCategory}
                              onKeyDown={e => e.key === 'Enter' && handleUpdateCategory()}
                              className="bg-transparent border-b border-pink-300 outline-none flex-1 mr-2 font-bold"
                            />
                          ) : (
                            <span className="text-pink-dark font-bold">{parent.name}</span>
                          )}
                          <div className="flex gap-1">
                            <button onClick={() => setEditingCategory(parent)} className="p-1 text-slate-400 hover:text-pink-dark"><Edit2 size={14} /></button>
                            <button onClick={() => handleDeleteCategory(parent.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        {/* Subcategories in list */}
                        <div className="pl-6 space-y-2">
                          {categories.filter(c => c.parent_id === parent.id).map(sub => (
                            <div key={sub.id} className="flex items-center justify-between p-2 bg-white border border-pink-50 rounded-lg">
                              {editingCategory?.id === sub.id ? (
                                <input 
                                  autoFocus
                                  value={editingCategory.name}
                                  onChange={e => setEditingCategory({...editingCategory, name: e.target.value})}
                                  onBlur={handleUpdateCategory}
                                  onKeyDown={e => e.key === 'Enter' && handleUpdateCategory()}
                                  className="bg-transparent border-b border-pink-300 outline-none flex-1 mr-2 text-sm"
                                />
                              ) : (
                                <span className="text-slate-600 text-sm">{sub.name}</span>
                              )}
                              <div className="flex gap-1">
                                <button onClick={() => setEditingCategory(sub)} className="p-1 text-slate-300 hover:text-pink-dark"><Edit2 size={12} /></button>
                                <button onClick={() => handleDeleteCategory(sub.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* Orphan categories if any */}
                    {categories.filter(c => c.parent_id && !categories.find(p => p.id === c.parent_id)).map(orphan => (
                       <div key={orphan.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                         <span className="text-red-400 text-sm">{orphan.name} (无上级)</span>
                         <button onClick={() => handleDeleteCategory(orphan.id)} className="p-1 text-red-300"><Trash2 size={14} /></button>
                       </div>
                    ))}
                  </div>
                </div>
                <div className="bg-pink-50/50 rounded-2xl p-6 flex flex-col justify-center text-center">
                  <p className="text-pink-dark/60 text-sm mb-4">
                    支持二级分类。您可以先创建一级分类，然后在添加新分类时选择其所属的上级分类。
                  </p>
                  <div className="flex justify-center">
                    <button 
                      onClick={async () => {
                        if (!confirm("确定要清空所有相册数据吗？此操作不可恢复。")) return;
                        await fetch('/api/albums/clear', { method: 'POST' });
                        fetchData();
                        alert("所有相册已清空");
                      }}
                      className="py-2 px-6 bg-white border border-red-100 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                      🗑️ 清空所有相册
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Post New Album */}
            <div className="glass-card rounded-3xl p-8 mb-8">
              <h3 className="text-xl font-serif font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Edit2 size={20} className="text-pink-dark" />
                {editingAlbumId ? '修改瞬间' : '发布新动态'}
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">标题</label>
                  <input 
                    type="text" 
                    value={newAlbum.title}
                    onChange={e => setNewAlbum(prev => ({...prev, title: e.target.value}))}
                    className="w-full px-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                    placeholder="给这段回忆起个名字..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">选择分类</label>
                  <div className="flex gap-4 flex-wrap">
                    {categories.filter(c => !c.parent_id).map(parent => (
                      <div key={parent.id} className="flex flex-col gap-2 p-3 bg-pink-50/30 rounded-2xl border border-pink-100">
                        <span className="text-[10px] font-bold text-pink-dark/40 uppercase tracking-widest px-1">{parent.name}</span>
                        <div className="flex gap-2 flex-wrap">
                          <button 
                            onClick={() => setNewAlbum(prev => ({...prev, category_id: parent.id}))}
                            className={`px-4 py-1.5 rounded-full text-xs transition-all ${newAlbum.category_id === parent.id ? 'pink-gradient text-white shadow-md' : 'bg-white text-pink-dark border border-pink-100'}`}
                          >
                            全部
                          </button>
                          {categories.filter(c => c.parent_id === parent.id).map(sub => (
                            <button 
                              key={sub.id}
                              onClick={() => setNewAlbum(prev => ({...prev, category_id: sub.id}))}
                              className={`px-4 py-1.5 rounded-full text-xs transition-all ${newAlbum.category_id === sub.id ? 'pink-gradient text-white shadow-md' : 'bg-white text-pink-dark border border-pink-100'}`}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">图文介绍 (支持富文本)</label>
                  <div className="bg-white rounded-xl overflow-hidden border border-pink-100">
                    <ReactQuill 
                      theme="snow" 
                      value={newAlbum.description} 
                      onChange={val => setNewAlbum(prev => ({...prev, description: val}))}
                      modules={quillModules}
                      className="h-64 mb-12"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">媒体文件 (支持多选)</label>
                  {newAlbum.media && newAlbum.media.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {newAlbum.media.map((item, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden aspect-square group">
                          {item.type === 'image' ? (
                            <img src={item.url} className="w-full h-full object-cover" />
                          ) : (
                            <video src={item.url} className="w-full h-full object-cover" />
                          )}
                          <button 
                            onClick={() => {
                              setNewAlbum(prev => {
                                const updatedMedia = [...(prev.media || [])];
                                updatedMedia.splice(idx, 1);
                                return {...prev, media: updatedMedia};
                              });
                            }}
                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <MediaUploader 
                        isUploading={isUploading}
                        setIsUploading={setIsUploading}
                        onUpload={(items) => setNewAlbum(prev => ({...prev, media: [...(prev.media || []), ...items]}))} 
                      />
                    </div>
                  ) : (
                    <MediaUploader 
                      isUploading={isUploading}
                      setIsUploading={setIsUploading}
                      onUpload={(items) => setNewAlbum(prev => ({...prev, media: items}))} 
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2 flex justify-between items-center">
                      <span>地点名称</span>
                      <button 
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((pos) => {
                              setNewAlbum(prev => ({
                                ...prev,
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude
                              }));
                              alert("已获取当前坐标并填入");
                            }, (err) => {
                              alert("获取位置失败，请确保已开启 GPS 并允许访问");
                            }, { enableHighAccuracy: true });
                          }
                        }}
                        className="text-[10px] text-pink-dark font-bold bg-pink-50 px-2 py-1 rounded-lg hover:bg-pink-100 transition-colors"
                      >
                        获取当前坐标
                      </button>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300" size={18} />
                      <input 
                        type="text" 
                        value={newAlbum.location_name || ''}
                        onChange={e => setNewAlbum(prev => ({...prev, location_name: e.target.value}))}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                        placeholder="例如：巴黎铁塔"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-600 mb-2">纬度 (Lat)</label>
                      <input 
                        type="number" 
                        step="any"
                        value={newAlbum.lat || ''}
                        onChange={e => setNewAlbum(prev => ({...prev, lat: parseFloat(e.target.value)}))}
                        className="w-full px-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                        placeholder="39.9"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-600 mb-2">经度 (Lng)</label>
                      <input 
                        type="number" 
                        step="any"
                        value={newAlbum.lng || ''}
                        onChange={e => setNewAlbum(prev => ({...prev, lng: parseFloat(e.target.value)}))}
                        className="w-full px-4 py-3 rounded-xl border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                        placeholder="116.4"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  {editingAlbumId && (
                    <button 
                      onClick={() => {
                        setEditingAlbumId(null);
                        setNewAlbum({
                          title: '',
                          description: '',
                          category_id: categories[0]?.id || 1,
                          media: [],
                          lat: null,
                          lng: null,
                          location_name: ''
                        });
                      }}
                      className="flex-1 py-4 border border-slate-200 text-slate-500 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all"
                    >
                      取消修改
                    </button>
                  )}
                  <button 
                    onClick={handleAddAlbum}
                    className={`${editingAlbumId ? 'flex-[2]' : 'w-full'} py-4 pink-gradient text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-pink-200 transition-all`}
                  >
                    {editingAlbumId ? '保存修改' : '发布瞬间'}
                  </button>
                </div>
              </div>
            </div>

            {/* Manage List */}
            <div className="glass-card rounded-3xl p-8">
              <h2 className="text-xl font-serif font-bold text-slate-800 mb-6">管理已发布内容</h2>
              <div className="space-y-4">
                {albums.map(album => (
                  <div key={album.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-pink-50 transition-colors border border-transparent hover:border-pink-100">
                    <img src={album.media[0]?.url} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800">{album.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-pink-dark font-medium text-xs">{album.category_name}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{new Date(album.created_at).toLocaleDateString()}</span>
                        {(album.lat === null || album.lng === null) && (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-400 text-[10px] rounded font-bold">无位置</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div className="flex flex-col gap-1 mr-2">
                        <button 
                          onClick={() => handleReorder(album, 'up')}
                          disabled={albums.indexOf(album) === 0}
                          className="p-1 text-slate-300 hover:text-pink-dark disabled:opacity-20"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button 
                          onClick={() => handleReorder(album, 'down')}
                          disabled={albums.indexOf(album) === albums.length - 1}
                          className="p-1 text-slate-300 hover:text-pink-dark disabled:opacity-20"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      <button 
                        onClick={() => handleEditAlbum(album)}
                        className="p-3 text-slate-300 hover:text-pink-dark hover:bg-pink-50 rounded-full transition-all"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button 
                        onClick={() => handleDeleteAlbum(album.id)}
                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
                {albums.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    暂无已发布的内容
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Marquee Announcement Bar (Only on Homepage) */}
      {!activeAlbum && !isAdmin && settings.announcement && (
        <div className="fixed bottom-0 left-0 right-0 z-[70] bg-black/50 backdrop-blur-md h-10 flex items-center overflow-hidden border-t border-white/10">
          <div className="whitespace-nowrap animate-marquee py-2">
            <span className="text-yellow-400 font-bold px-4 text-sm tracking-widest">
              {settings.announcement}
            </span>
            {/* Duplicate for seamless loop */}
            <span className="text-yellow-400 font-bold px-4 text-sm tracking-widest">
              {settings.announcement}
            </span>
            <span className="text-yellow-400 font-bold px-4 text-sm tracking-widest">
              {settings.announcement}
            </span>
            <span className="text-yellow-400 font-bold px-4 text-sm tracking-widest">
              {settings.announcement}
            </span>
          </div>
        </div>
      )}

      {/* Customer Service Floating Button (Only on Content Page) */}
      {activeAlbum && !isAdmin && settings.customer_service_url && (
        <motion.a
          href={settings.customer_service_url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0, opacity: 0, y: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-8 right-8 z-[60] w-14 h-14 bg-[#24A1DE] rounded-full flex items-center justify-center text-white shadow-2xl cursor-pointer"
        >
          <Send size={24} className="mr-0.5" />
        </motion.a>
      )}

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="pink-gradient p-8 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock size={32} />
                </div>
                <h3 className="text-2xl font-serif font-bold">管理员登录</h3>
                <p className="text-sm opacity-80 mt-2">请输入您的凭据以访问后台</p>
              </div>
              
              <form onSubmit={handleLogin} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">用户名</label>
                  <input 
                    type="text" 
                    required
                    value={loginForm.username}
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
                    placeholder="Username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">密码</label>
                  <input 
                    type="password" 
                    required
                    value={loginForm.password}
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
                    placeholder="Password"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowLogin(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-3 pink-gradient text-white rounded-xl font-bold shadow-lg hover:shadow-pink-200 transition-all"
                  >
                    登录
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Navigation Modal */}
      <AnimatePresence>
        {activeMapAlbum && (
          <MapModal 
            album={activeMapAlbum} 
            onClose={() => setActiveMapAlbum(null)} 
          />
        )}
      </AnimatePresence>

      {/* Mobile Navigation Spacer */}
      <div className="h-20 md:hidden"></div>
    </div>
  );
}
