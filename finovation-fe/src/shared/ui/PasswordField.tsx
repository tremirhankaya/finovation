import { useState } from "react"
import EyeIcon from "@/shared/ui/icons/EyeIcon"
import Button from "@/shared/ui/Button"
import TextField, { type TextFieldProps } from "@/shared/ui/TextField"

type PasswordFieldProps = Omit<TextFieldProps, "type" | "endAdornment">

export default function PasswordField(props: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <TextField
      {...props}
      type={isVisible ? "text" : "password"}
      endAdornment={
        <Button
          variant="icon"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Şifreyi gizle" : "Şifreyi göster"}
          aria-pressed={isVisible}
        >
          <EyeIcon visible={isVisible} />
        </Button>
      }
    />
  )
}
