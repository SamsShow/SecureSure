// Import necessary modules
import { useAuth0 } from "@auth0/auth0-react";
import React from "react";


function Login() {
  // Destructure the loginWithRedirect function from the useAuth0 hook
  const { user, loginWithRedirect } = useAuth0();
  
  console.log("Current User:", user); // Logs user info if authenticated

  return (
    <div className="App">
      <header className="App-header">
        {/* Button to trigger the login with Auth0 */}
        <button onClick={() => loginWithRedirect()}>Login with Redirect</button>
      </header>
    </div>
  );
}

export default Login;
