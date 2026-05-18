import { HomePageLoadProvider } from "../context/HomePageLoadContext";
import { HomePageSkeletonGate } from "../components/HomePageSkeletonGate";
import { HomeScreen } from "./HomeScreen";

function ModernHomePage() {
  return (
    <HomePageLoadProvider>
      <HomePageSkeletonGate>
        <HomeScreen layoutVariant="desktop" />
      </HomePageSkeletonGate>
    </HomePageLoadProvider>
  );
}

export default ModernHomePage;
