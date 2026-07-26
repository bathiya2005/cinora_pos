Put your Alona IT logo file here, named exactly:

    alona-logo.png

(PNG with transparent background recommended, square ~200x200px)

Vite automatically serves everything in this "public" folder from the
site root, so this file becomes reachable at:  /alona-logo.png

The Sidebar component (src/components/Sidebar.tsx) already references
this path directly in code — no need to touch Template Settings.

---

Also put your login screen logo here, named exactly:

    login-logo.png

This becomes reachable at:  /login-logo.png
The LoginScreen component (src/components/LoginScreen.tsx) references
this path directly in code — independent of Template Settings. Changing
the logo from Settings (Bill Template) will NOT change this login logo;
to change it, replace this file.
(Currently a copy of alona-logo.png is used as a placeholder — replace
it with your own file to change the login screen logo.)

---

The Navbar (top bar shown after login) also uses alona-logo.png directly
(src/components/Navbar.tsx), same as the Sidebar. shop-logo.png is no
longer referenced by any component but is left here in case it's needed
again later.
