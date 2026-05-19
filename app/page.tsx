import dynamic from 'next/dynamic'

const RainMap = dynamic(() => import('@/components/Map'), { ssr: false })

export default function Home() {
  return <main className="w-full h-screen"><RainMap /></main>
}