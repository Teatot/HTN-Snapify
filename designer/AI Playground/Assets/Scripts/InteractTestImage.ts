import { ImageGenerator } from "./ImageGenerator";


@component
export class InteractTestImage extends BaseScriptComponent {
    private prompt: string = "Flat vector logo: WEEF in bold geometric sans, all caps, bright yellow #F6DF0E on black or transparent. Center a grey circular engineering seal (#C1C1C0, thin black ring) with ring text 'ENGINEERING • UNIVERSITY OF WATERLOO'. Inside: black gear/tool motif crossed by a yellow lightning bolt. Add two yellow semicircular arrows forming a clockwise loop around the seal (top L→R, bottom R→L), concentric with it. Thick strokes, squared terminals, tight letter spacing, high contrast, no gradients/3D/shadows. Aspect ratio ~2:1, transparent background, crisp outlines suitable for SVG.";

    private modelProvider: string = "OpenAI";   
    @ui.separator
    @input
    private image: Image; 
    private imageGenerator: ImageGenerator = null; 
    @input private spinner: SceneObject; 


    onAwake() {

        this.imageGenerator = new ImageGenerator(this.modelProvider); 
        let imgMat = this.image.mainMaterial.clone(); 
        this.image.clearMaterials(); 
        this.image.mainMaterial = imgMat; 
        this.spinner.enabled = false; 
        this.createImage(this.prompt); 

        
    }

    createImage(prompt: string ) {
        this.spinner.enabled = true; 
        this.imageGenerator
        .generateImage(prompt)
        .then( (image) => {
            print("Image Generated Succesfully"); 
            this.image.mainMaterial.mainPass.baseTex = image; 
            this.spinner.enabled = false; 
        })
        .catch( (error) => {
            print("Error Generating Image: " + error ); 
            this.spinner.enabled = false; 
        });
    }
}
