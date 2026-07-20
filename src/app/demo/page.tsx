import Navbar from "@/components/shared/Navbar";
import ModelViewer from "@/components/shared/ModelViewer";

export default function DemoPage() {
  return (
    <main>
      <Navbar />
      <section className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-black mb-6">3D / AR Viewer Demo</h1>
        <div className="h-[650px] bg-white rounded-3xl overflow-hidden border shadow">
          <ModelViewer />
        </div>
      </section>
    </main>
  );
}