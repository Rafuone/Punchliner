import Host from './screens/Host';
import Player from './screens/Player';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  const isHost = path.endsWith('/host');
  return <div className="app">{isHost ? <Host /> : <Player />}</div>;
}
