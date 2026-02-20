import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function Account({ profile }) {

  return (
    <div>
      <h2>Account</h2>

      <div className="card">
        <p><strong>Name:</strong> {profile?.displayName}</p>
        <p><strong>Role:</strong> {profile?.role}</p>
      </div>

      <button
        className="btn-primary"
        onClick={() => signOut(auth)}
      >
        Logout
      </button>
    </div>
  );
}

export default Account;
