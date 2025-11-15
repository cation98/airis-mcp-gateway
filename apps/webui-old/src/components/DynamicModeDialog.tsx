import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { AlertTriangle } from 'lucide-react';

type DynamicModeDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DynamicModeDialog({ open, onConfirm, onCancel }: DynamicModeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-[#ff9f0a]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#ff9f0a]" />
            </div>
            <AlertDialogTitle className="text-[#e8e8e8]">
              Disable Dynamic Mode?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-[#888]">
            Enabling this server manually will disable Dynamic Mode. 
            <br /><br />
            With Dynamic Mode enabled, the LLM automatically manages server activation based on context, which reduces token usage and improves performance.
            <br /><br />
            Are you sure you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onCancel}
            className="bg-[#2a2a2a] border-[#333] text-[#e8e8e8] hover:bg-[#333]"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-[#ff9f0a] hover:bg-[#ff9f0a]/90 text-white"
          >
            Disable Dynamic Mode
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
