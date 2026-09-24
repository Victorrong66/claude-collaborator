import { LandingScreen } from "./components/LandingScreen";
import { SessionScreen } from "./components/SessionScreen";
import { useCollabSession } from "./state/useCollabSession";
import "./App.css";

function App() {
  const { state, hostSession, joinSession, sendMessage, sendTyping } = useCollabSession();

  if (state.phase === "active") {
    return <SessionScreen state={state} onSend={sendMessage} onTyping={sendTyping} />;
  }

  return (
    <LandingScreen
      connectionError={state.connectionError}
      onHost={hostSession}
      onJoin={joinSession}
    />
  );
}

export default App;
