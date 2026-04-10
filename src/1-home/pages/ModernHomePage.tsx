import { HomePageLoadProvider } from "../context/HomePageLoadContext";
import { HomeScreen } from "./HomeScreen";

function ModernHomePage() {
  return (
    <HomePageLoadProvider>
      <HomeScreen layoutVariant="desktop" />
    </HomePageLoadProvider>
  );
}

export default ModernHomePage;
