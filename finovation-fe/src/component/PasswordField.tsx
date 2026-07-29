import { useState } from "react"
import EyeIcon from "@/assets/icons/EyeIcon"
import Button from "@/component/Button"
import TextField, { type TextFieldProps } from "@/component/TextField"

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
