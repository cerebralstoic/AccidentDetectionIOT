export default function TopBar() {
    return (
        <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#1A1C1E] flat no shadows">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-highest">
                    <img
                        alt="User profile avatar"
                        className="w-full h-full object-cover"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjGLfu2iXJV1drEexMnMzSdexpk_zSFuIW6-jPC6UbPjITGLR9BEYsMamidN7vPlQQe30bX2_BsKK6nmBIgqJozUUrTnUe2JYUwBlyBrrJRsEUqWRbdOash1s7g5kEEI-U3xXfVu7oGMs5dRNUw4zfu5FtUQl7Ga6cQSKWc1WmQddpHqbHpiKTxHBhtFByZ4l7T6inia_ewKld1aOQmcS9vavPPqyRs45Q897LHqbSzB8VVEdi0zj_AnHAX4rA7jFKrWZ8YtSypXY"
                    />
                </div>
                <span className="text-lg font-black tracking-tighter text-[#D32F2F] uppercase font-headline">Sentinel IoT</span>
            </div>
            <div className="flex items-center gap-4">
                <button className="material-symbols-outlined text-[#909090] hover:bg-[#282A2C] transition-colors p-2 rounded-full">sensors</button>
            </div>
        </header>
    );
}
