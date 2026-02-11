import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import AddIcon from "@mui/icons-material/Add";
import MenuIcon from "@mui/icons-material/Menu";
import ShareIcon from "@mui/icons-material/Share";

type BottomBarProps = {
  onOpenDrawer: () => void;
  onAddItem: () => void;
};

const BottomBar = ({ onOpenDrawer, onAddItem }: BottomBarProps) => {
  return (
    <AppBar
      position="fixed"
      color="primary"
      sx={{
        top: "auto",
        bottom: 0,
        background: "radial-gradient(circle at 50% -6px, transparent 33px, #005382 34px)",
        overflow: "visible"
      }}
    >
      <Toolbar sx={{ position: "relative" }}>
        <IconButton color="inherit" aria-label="Open list menu" onClick={onOpenDrawer}>
          <MenuIcon />
        </IconButton>

        <Fab
          color="secondary"
          aria-label="Add item"
          onClick={onAddItem}
          sx={{
            position: "absolute",
            zIndex: 1,
            top: -30,
            left: 0,
            right: 0,
            margin: "0 auto",
            bgcolor: "#005382",
            color: "#ffffff",
            "&:hover": { bgcolor: "#00466f" }
          }}
        >
          <AddIcon />
        </Fab>

        <Box sx={{ flexGrow: 1 }} />

        <IconButton color="inherit" aria-label="Share list">
          <ShareIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default BottomBar;
