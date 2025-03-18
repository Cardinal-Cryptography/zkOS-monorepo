use syn::{AttributeArgs, Lit, LitStr, Meta, NestedMeta};

pub fn find_constructor(attr_args: AttributeArgs) -> Option<String> {
    // We'll extract the user-provided constructor name if present
    let mut constructor_name: Option<String> = None;

    for nested in attr_args {
        match nested {
            NestedMeta::Meta(Meta::NameValue(name_value)) => {
                if name_value.path.is_ident("constructor") {
                    // e.g. constructor = "my_constructor"
                    if let Lit::Str(lit_str) = &name_value.lit {
                        constructor_name = Some(lit_str.value());
                    } else {
                        panic!("Expected string literal for `constructor = \"...\"`");
                    }
                }
            }
            _ => {
                panic!("Unsupported attribute argument format");
            }
        }
    }

    constructor_name
}

pub fn find_arg(attr_args: AttributeArgs, arg_name: &str) -> Option<LitStr> {
    for nested in attr_args {
        match nested {
            NestedMeta::Meta(Meta::NameValue(name_value)) => {
                if name_value.path.is_ident(arg_name) {
                    // e.g. constructor = "my_constructor"
                    if let Lit::Str(lit_str) = &name_value.lit {
                        return Some(lit_str.clone());
                    } else {
                        panic!("Expected string literal for `constructor = \"...\"`");
                    }
                }
            }
            _ => {
                panic!("Unsupported attribute argument format");
            }
        }
    }

    None
}
