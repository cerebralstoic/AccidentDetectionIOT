import { Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
    const location = useLocation();

    const navItems = [
        { name: 'Dashboard', icon: 'dashboard', path: '/dashboard', private: true },
        { name: 'Map', icon: 'explore', path: '/', private: false },
        { name: 'SOS', icon: 'emergency', path: '/emergency', private: true, special: true },
        { name: 'Logs', icon: 'history', path: '/logs', private: true },
        { name: 'Settings', icon: 'settings', path: '/settings', private: true },
    ];

    return (
        <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 h-20 pb-safe bg-[#121416]/90 backdrop-blur-xl border-t border-[#37393B]/20 shadow-[0_-4px_20px_0_rgba(211,47,47,0.08)]">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;

                if (item.special) {
                    return (
                        <Link key={item.name} to={item.path} className={`flex flex-col items-center justify-center transition-all ${isActive ? 'text-white scale-110' : 'text-[#FFB3AC] scale-110 hover:text-white'}`}>
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                            <span className="font-['Inter'] text-[10px] font-medium tracking-wide">{item.name}</span>
                        </Link>
                    )
                }

                return (
                    <Link key={item.name} to={item.path} className={`flex flex-col items-center justify-center transition-all ${isActive ? 'text-primary opacity-100' : 'text-[#909090] opacity-60 hover:text-white'}`}>
                        <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                        <span className="font-['Inter'] text-[10px] font-medium tracking-wide">{item.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
