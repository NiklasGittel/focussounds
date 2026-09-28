import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SlidersHorizontalIcon } from "lucide-react";
import LayerVolumeSlider from "./VolumeSlider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const VolumesMenu = () => {
    const layers: Layer[] = ["master", "music", "whitenoise", "binauralbeats"];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Submit">
                <SlidersHorizontalIcon />
            </Button>} />
            <DropdownMenuContent className="w-48" align="end" >
                <DropdownMenuGroup>
                    {layers.map((layer) => (
                        <div key={layer}>
                            <DropdownMenuItem className="p-2">
                                <div className="flex flex-col gap-2 w-full">
                                    <Label className="text-muted-foreground">{layer.charAt(0).toUpperCase() + layer.slice(1)}</Label>
                                    <LayerVolumeSlider layer={layer} />
                                </div>
                            </DropdownMenuItem>
                            {layer === "master" && <DropdownMenuSeparator />}
                        </div>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default VolumesMenu;