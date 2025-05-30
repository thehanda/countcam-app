import { Camera } from 'lucide-react';

export default function Header() {
  return (
    <header className="py-6 bg-card border-b shadow-sm">
      <div className="container mx-auto flex items-center space-x-3 px-4 sm:px-6 lg:px-8">
        <Camera className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold text-primary tracking-tight">
          CountCam
        </h1>
      </div>
    </header>
  );
}
